import { z } from "zod";

const principalSchema = z.object({
  subject: z.string().min(1).max(128),
  groups: z.array(z.string().max(128)).max(100),
}).strict();

export function requireQuizmaster(rawPrincipal: unknown): string {
  const principal = principalSchema.parse(rawPrincipal);
  if (!principal.groups.includes("Quizmasters")) throw new Error("Keine Berechtigung zur Spielsteuerung.");
  return principal.subject;
}
