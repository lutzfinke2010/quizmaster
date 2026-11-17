import { z } from "zod";
import {
  TransactGetCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { isConditionalFailure, withTransactionConflictRetry } from "./transactionRetry";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const identity = z.string().regex(/^[A-Za-z0-9_:.-]{1,128}$/);
const inputSchema = z.object({ sessionId: id, questionId: id, choiceId: id }).strict();
const metaSchema = z.object({
  status: z.string(),
  currentQuestionId: id.nullish(),
  opensAt: z.number().nullish(),
  closesAt: z.number().nullish(),
  expiresAt: z.number(),
});
const participantSchema = z.object({ participantId: id });
const answerSchema = z.object({ choiceId: id, receivedAt: z.number() });

export type AnswerInput = z.infer<typeof inputSchema>;
export interface AnswerContext {
  meta: z.infer<typeof metaSchema> | null;
  participant: z.infer<typeof participantSchema> | null;
  answer: z.infer<typeof answerSchema> | null;
}

export interface AnswerStore {
  read(input: AnswerInput, identityId: string): Promise<AnswerContext>;
  accept(input: AnswerInput, identityId: string, participantId: string, receivedAt: number, expiresAt: number,
    previousAnswer: AnswerContext["answer"]): Promise<void>;
}

export class AnswerError extends Error {
  readonly code: "NOT_AUTHORIZED" | "NOT_OPEN" | "CONFLICT" | "REJECTED";
  constructor(code: "NOT_AUTHORIZED" | "NOT_OPEN" | "CONFLICT" | "REJECTED") {
    super({
      NOT_AUTHORIZED: "Keine gültige Teilnahme an dieser Sitzung.",
      NOT_OPEN: "Die Frage ist nicht zur Beantwortung geöffnet.",
      CONFLICT: "Deine Antwort wurde inzwischen geändert. Bitte prüfe deine gespeicherte Antwort.",
      REJECTED: "Die Antwort konnte nicht angenommen werden.",
    }[code]);
    this.name = "AnswerError";
    this.code = code;
  }
}

function existingAnswer(context: AnswerContext, input: AnswerInput, receivedAt: number) {
  if (!context.meta || !context.participant || context.meta.expiresAt <= receivedAt) {
    throw new AnswerError("NOT_AUTHORIZED");
  }
  if (context.answer?.choiceId === input.choiceId) {
    return { acceptedAt: context.answer.receivedAt };
  }
  return null;
}

function requireOpen(context: AnswerContext, input: AnswerInput, receivedAt: number) {
  if (!context.meta || !context.participant ||
      context.meta.status !== "QUESTION_OPEN" ||
      context.meta.currentQuestionId !== input.questionId ||
      context.meta.opensAt == null || context.meta.closesAt == null ||
      receivedAt < context.meta.opensAt || receivedAt >= context.meta.closesAt) {
    throw new AnswerError("NOT_OPEN");
  }
  if (context.answer && receivedAt <= context.answer.receivedAt) throw new AnswerError("CONFLICT");
  return { participantId: context.participant.participantId, expiresAt: context.meta.expiresAt };
}

/**
 * `identityId` and `receivedAt` must be obtained by the authenticated server entry point,
 * never from GraphQL arguments. This module is not itself an authorization boundary.
 */
export async function submitAnswer(
  store: AnswerStore,
  rawInput: unknown,
  identityId: string,
  receivedAt: number,
): Promise<{ acceptedAt: number }> {
  const input = inputSchema.parse(rawInput);
  identity.parse(identityId);
  if (!Number.isSafeInteger(receivedAt) || receivedAt < 0) throw new Error("Ungültige Serverzeit.");

  let context = await withTransactionConflictRetry(() => store.read(input, identityId));
  for (let attempt = 0; attempt < 4; attempt++) {
    const existing = existingAnswer(context, input, receivedAt);
    if (existing) return existing;
    const { participantId, expiresAt } = requireOpen(context, input, receivedAt);
    const previousAnswer = context.answer;
    try {
      await withTransactionConflictRetry(() =>
        store.accept(input, identityId, participantId, receivedAt, expiresAt, previousAnswer));
      return { acceptedAt: receivedAt };
    } catch (error) {
      // Reconcile a lost receipt or a competing write before attempting a new transaction.
      const after = await withTransactionConflictRetry(() => store.read(input, identityId));
      const retry = existingAnswer(after, input, receivedAt);
      if (retry) return retry;
      if (!isConditionalFailure(error)) throw error;
      requireOpen(after, input, receivedAt);
      if (after.answer?.choiceId === previousAnswer?.choiceId &&
          after.answer?.receivedAt === previousAnswer?.receivedAt) throw new AnswerError("REJECTED");
      context = after;
    }
  }
  throw new AnswerError("CONFLICT");
}

function keys(input: AnswerInput, identityId: string) {
  const pk = `SESSION#${input.sessionId}`;
  return {
    meta: { pk, sk: "META" },
    participant: { pk, sk: `IDENTITY#${identityId}` },
    question: { pk, sk: `QUESTION#${input.questionId}` },
  };
}

function answerKey(input: AnswerInput, participantId: string) {
  return { pk: `SESSION#${input.sessionId}`, sk: `ANSWER#${input.questionId}#${participantId}` };
}

export function buildAnswerTransaction(
  tableName: string,
  input: AnswerInput,
  identityId: string,
  participantId: string,
  receivedAt: number,
  expiresAt: number,
  previousAnswer: AnswerContext["answer"] = null,
): TransactWriteCommandInput {
  const itemKeys = keys(input, identityId);
  const metaCondition = "#status = :open AND currentQuestionId = :question AND opensAt <= :received AND closesAt > :received AND expiresAt = :expiresAt AND expiresAt > :received";
  const metaValues = { ":open": "QUESTION_OPEN", ":question": input.questionId, ":received": receivedAt, ":expiresAt": expiresAt };
  return { TransactItems: [
    // Antworten erhöhen nie `#version` (nur Phasenwechsel). Eine geänderte Antwort schreibt META gar nicht,
    // die erste Antwort nur den Zähler; der Stream-Publisher bündelt Zählerereignisse (siehe README).
    previousAnswer
      ? { ConditionCheck: {
        TableName: tableName,
        Key: itemKeys.meta,
        ConditionExpression: metaCondition,
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: metaValues,
      } }
      : { Update: {
        TableName: tableName,
        Key: itemKeys.meta,
        UpdateExpression: "ADD answerCount :one",
        ConditionExpression: metaCondition,
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ...metaValues, ":one": 1 },
      } },
    { ConditionCheck: {
      TableName: tableName,
      Key: itemKeys.participant,
      ConditionExpression: "participantId = :participant",
      ExpressionAttributeValues: { ":participant": participantId },
    } },
    { ConditionCheck: {
      TableName: tableName,
      Key: itemKeys.question,
      ConditionExpression: "contains(answerIds, :choice)",
      ExpressionAttributeValues: { ":choice": input.choiceId },
    } },
    { Put: {
      TableName: tableName,
      Item: { ...answerKey(input, participantId), choiceId: input.choiceId, receivedAt, ttl: Math.ceil(expiresAt / 1000) },
      ConditionExpression: previousAnswer
        ? "choiceId = :previousChoice AND receivedAt = :previousReceived AND receivedAt < :received"
        : "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      ...(previousAnswer ? { ExpressionAttributeValues: {
        ":previousChoice": previousAnswer.choiceId, ":previousReceived": previousAnswer.receivedAt, ":received": receivedAt,
      } } : {}),
    } },
  ] };
}

export class DynamoAnswerStore implements AnswerStore {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(client: DynamoDBDocumentClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  async read(input: AnswerInput, identityId: string): Promise<AnswerContext> {
    const itemKeys = keys(input, identityId);
    // The participant ID is server-owned; read it before deriving the answer key.
    const identityResult = await this.client.send(new TransactGetCommand({
      TransactItems: [
        { Get: { TableName: this.tableName, Key: itemKeys.meta } },
        { Get: { TableName: this.tableName, Key: itemKeys.participant } },
      ],
    }));
    const metaItem = identityResult.Responses?.[0]?.Item;
    const participantItem = identityResult.Responses?.[1]?.Item;
    if (!metaItem || !participantItem) return { meta: null, participant: null, answer: null };
    const participant = participantSchema.parse(participantItem);
    const result = await this.client.send(new TransactGetCommand({
      TransactItems: [
        { Get: { TableName: this.tableName, Key: itemKeys.meta } },
        { Get: { TableName: this.tableName, Key: itemKeys.participant } },
        { Get: { TableName: this.tableName, Key: answerKey(input, participant.participantId) } },
      ],
    }));
    const freshMeta = result.Responses?.[0]?.Item;
    const freshParticipant = result.Responses?.[1]?.Item;
    const answer = result.Responses?.[2]?.Item;
    if (!freshMeta || !freshParticipant) return { meta: null, participant: null, answer: null };
    const parsedParticipant = participantSchema.parse(freshParticipant);
    if (parsedParticipant.participantId !== participant.participantId) {
      throw new Error("Teilnahme wurde während der Anfrage geändert.");
    }
    return { meta: metaSchema.parse(freshMeta), participant: parsedParticipant,
      answer: answer ? answerSchema.parse(answer) : null };
  }

  async accept(input: AnswerInput, identityId: string, participantId: string, receivedAt: number, expiresAt: number,
    previousAnswer: AnswerContext["answer"]): Promise<void> {
    await this.client.send(new TransactWriteCommand(
      buildAnswerTransaction(this.tableName, input, identityId, participantId, receivedAt, expiresAt, previousAnswer),
    ));
  }
}
