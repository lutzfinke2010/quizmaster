import { z } from "zod";

export function quizmasterIdentity(identity: unknown) {
  const parsed = z.object({
    sub: z.string().min(1).max(128),
    claims: z.object({ "cognito:groups": z.array(z.string()).optional() }),
  }).safeParse(identity);
  if (!parsed.success) throw new Error("Keine Admin-Anmeldung.");
  return { subject: parsed.data.sub, groups: parsed.data.claims["cognito:groups"] ?? [] };
}

export function guestIdentity(identity: unknown, poolId: string): string {
  const parsed = z.object({
    cognitoIdentityId: z.string().min(1).max(128),
    cognitoIdentityAuthType: z.enum(["unauthenticated", "authenticated"]),
    cognitoIdentityPoolId: z.string(),
  }).safeParse(identity);
  if (!parsed.success || parsed.data.cognitoIdentityPoolId !== poolId) {
    throw new Error("Keine gültige Gastidentität.");
  }
  return parsed.data.cognitoIdentityId;
}
