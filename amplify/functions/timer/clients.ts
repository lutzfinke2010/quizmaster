import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SFNClient } from "@aws-sdk/client-sfn";

export const database = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const sfn = new SFNClient({});

export function environment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
