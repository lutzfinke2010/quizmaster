import type { DynamoDBStreamEvent } from "aws-lambda";
import { z } from "zod";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";

export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  const endpoint = process.env.GRAPHQL_ENDPOINT;
  const region = process.env.AWS_REGION;
  if (!endpoint || !region) throw new Error("Missing AppSync publisher configuration.");
  const url = new URL(endpoint);
  const signer = new SignatureV4({ service: "appsync", region, credentials: defaultProvider(), sha256: Sha256 });
  for (const record of event.Records) {
    if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") continue;
    const image = record.dynamodb?.NewImage;
    if (!image?.pk?.S || !image.sk?.S) throw new Error("Missing stream image.");
    if (!image.pk.S.startsWith("SESSION#") || image.sk.S !== "META") continue;
    const sessionId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).parse(image.pk.S.slice("SESSION#".length));
    const version = z.coerce.number().int().min(0).max(2_147_483_647).parse(image.version?.N);
    const expiresAt = z.coerce.number().int().parse(image.expiresAt?.N);
    if (expiresAt <= Date.now() || image.status?.S === "PREPARING" || image.status?.S === "FAILED") continue;
    const body = JSON.stringify({
      query: "mutation Publish($sessionId: ID!, $version: Int!) { publishGameEvent(sessionId: $sessionId, version: $version) { sessionId version } }",
      variables: { sessionId, version },
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
