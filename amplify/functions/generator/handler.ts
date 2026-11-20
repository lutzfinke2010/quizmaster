import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { runQuizGeneration } from "../../../src/server/quizGeneration";
import { setLogContext } from "../../../src/server/logger";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function environment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function handler(event: unknown, context?: { awsRequestId?: string }): Promise<void> {
  setLogContext({ requestId: context?.awsRequestId, operation: "quizGeneration" });
  const { jobId } = z.object({ jobId: z.string().uuid() }).strict().parse(event);
  await runQuizGeneration(client, environment("TABLE_NAME"), jobId, {
    apiKey: environment("OPENAI_API_KEY"), model: environment("OPENAI_MODEL"),
  });
}
