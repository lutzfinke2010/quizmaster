import { z } from "zod";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getAdminGameState, getPresentationState } from "../../../src/server/gameState";
import { getMyParticipation } from "../../../src/server/participation";
import { guestIdentity, quizmasterIdentity } from "../../../src/server/appsyncIdentity";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const schema = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  presentationToken: z.string().nullable().optional(),
  identity: z.unknown(),
}).strict();

export async function handler(raw: unknown) {
  const context = z.object({ arguments: z.object({ sessionId: z.string(), presentationToken: z.string().nullish() }),
    identity: z.unknown() }).parse(raw);
  const event = schema.parse({ ...context.arguments, identity: context.identity });
  const tableName = process.env.TABLE_NAME;
  const poolId = process.env.IDENTITY_POOL_ID;
  if (!tableName || !poolId) throw new Error("Missing required backend configuration.");
  const now = Date.now();
  if (event.presentationToken) {
    guestIdentity(event.identity, poolId);
    const state = await getPresentationState(client, tableName, event.presentationToken, now);
    if (state.sessionId !== event.sessionId) throw new Error("Keine gültige Berechtigung.");
  } else {
    const identity = z.object({ sub: z.string() }).safeParse(event.identity);
    if (identity.success) {
      await getAdminGameState(client, tableName, event.sessionId, quizmasterIdentity(event.identity), now);
    } else {
      const guest = guestIdentity(event.identity, poolId);
      await getMyParticipation(client, tableName, event.sessionId, guest, now);
    }
  }
  return { sessionId: event.sessionId };
}
