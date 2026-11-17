import type { DynamoDBStreamEvent } from "aws-lambda";
import { z } from "zod";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { logger } from "../../../src/server/logger";

const sessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const intSchema = z.coerce.number().int().min(0).max(2_147_483_647);

export interface GameEventPayload {
  sessionId: string;
  version: number;
  participantCount: number | null;
  answerCount: number | null;
}

/**
 * Verdichtet einen Stream-Batch auf höchstens ein Event je Sitzung (jeweils der neueste META-Stand).
 * Zusammen mit dem Batching-Fenster der Event-Source (backend.ts) entstehen so auch bei vielen gleichzeitigen
 * Antworten/Beitritten nur wenige Events pro Sekunde und Sitzung. Zählerstände reisen im Event mit, damit Clients
 * sie ohne erneutes Laden des Spielstands übernehmen können; nur `version`-Änderungen erfordern einen Reload.
 */
export function collectGameEvents(event: DynamoDBStreamEvent, now: number): GameEventPayload[] {
  const latest = new Map<string, GameEventPayload>();
  for (const record of event.Records) {
    if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") continue;
    const image = record.dynamodb?.NewImage;
    if (!image?.pk?.S || !image.sk?.S) throw new Error("Missing stream image.");
    if (!image.pk.S.startsWith("SESSION#") || image.sk.S !== "META") continue;
    const sessionId = sessionIdSchema.parse(image.pk.S.slice("SESSION#".length));
    const version = intSchema.parse(image.version?.N);
    const expiresAt = z.coerce.number().int().parse(image.expiresAt?.N);
    if (expiresAt <= now || image.status?.S === "PREPARING" || image.status?.S === "FAILED") {
      latest.delete(sessionId);
      continue;
    }
    const previous = latest.get(sessionId);
    // Stream-Reihenfolge je Schlüssel ist garantiert; ein späterer Datensatz ersetzt den früheren.
    if (previous && previous.version > version) continue;
    latest.set(sessionId, {
      sessionId, version,
      participantCount: image.participantCount?.N ? intSchema.parse(image.participantCount.N) : null,
      answerCount: image.answerCount?.N ? intSchema.parse(image.answerCount.N) : null,
    });
  }
  return [...latest.values()];
}

export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  const endpoint = process.env.GRAPHQL_ENDPOINT;
  const region = process.env.AWS_REGION;
  if (!endpoint || !region) throw new Error("Missing AppSync publisher configuration.");
  const url = new URL(endpoint);
  const signer = new SignatureV4({ service: "appsync", region, credentials: defaultProvider(), sha256: Sha256 });
  const events = collectGameEvents(event, Date.now());
  logger.debug("publisher.batch", { records: event.Records.length, events: events.length });
  for (const variables of events) {
    const body = JSON.stringify({
      query: "mutation Publish($sessionId: ID!, $version: Int!, $participantCount: Int, $answerCount: Int) { publishGameEvent(sessionId: $sessionId, version: $version, participantCount: $participantCount, answerCount: $answerCount) { sessionId version participantCount answerCount } }",
      variables,
    });
    const request = await signer.sign(new HttpRequest({
      protocol: url.protocol, hostname: url.hostname, port: url.port ? Number(url.port) : undefined,
      method: "POST", path: url.pathname, headers: { host: url.host, "content-type": "application/json" }, body,
    }));
    const response = await fetch(url, { method: "POST", headers: request.headers, body });
    if (!response.ok) throw new Error(`AppSync-Publikation fehlgeschlagen: HTTP ${response.status}`);
    const payload = z.object({ errors: z.array(z.object({ message: z.string() })).optional(),
      data: z.object({ publishGameEvent: z.object({ sessionId: z.string(), version: z.number() }) }).optional(),
    }).parse(await response.json());
    if (payload.errors?.length) throw new Error(`AppSync-Publikation wurde abgelehnt: ${payload.errors.map((error) => error.message).join("; ")}`);
    if (!payload.data) throw new Error("AppSync-Publikation lieferte keine Daten.");
  }
}
