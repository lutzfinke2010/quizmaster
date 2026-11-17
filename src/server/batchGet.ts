import { BatchGetCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

type Key = { pk: string; sk: string };

/**
 * Liest beliebig viele Items per `BatchGet` (100er-Blöcke, wiederholt unverarbeitete Schlüssel mit Backoff).
 * Ergebnis ist über `pk#sk` adressierbar; fehlende Items (z. B. bereits per TTL gelöscht) fehlen in der Map.
 */
export async function batchGetAll(
  client: DynamoDBDocumentClient, tableName: string, keys: Key[],
): Promise<Map<string, Record<string, unknown>>> {
  const found = new Map<string, Record<string, unknown>>();
  const unique = [...new Map(keys.map((key) => [`${key.pk}#${key.sk}`, key])).values()];
  for (let offset = 0; offset < unique.length; offset += 100) {
    let pending: Key[] = unique.slice(offset, offset + 100);
    for (let attempt = 0; pending.length > 0; attempt++) {
      if (attempt >= 6) throw new Error("Daten konnten nicht vollständig geladen werden. Bitte erneut versuchen.");
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, Math.random() * Math.min(1_000, 50 * 2 ** attempt)));
      const result = await client.send(new BatchGetCommand({
        RequestItems: { [tableName]: { Keys: pending, ConsistentRead: true } },
      }));
      for (const item of result.Responses?.[tableName] ?? []) found.set(`${String(item.pk)}#${String(item.sk)}`, item);
      pending = (result.UnprocessedKeys?.[tableName]?.Keys ?? []) as Key[];
    }
  }
  return found;
}

/** Führt asynchrone Arbeit mit begrenzter Parallelität aus und erhält die Reihenfolge der Ergebnisse. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[], limit: number, worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}
