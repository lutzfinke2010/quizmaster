import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  cloud, type AsyncParticipantResult, type AsyncStandingParticipant, type AsyncStandings,
} from "../cloud";
import { message } from "../ui/common/message";

const REFRESH_INTERVAL_MS = 10_000;
const MAX_TIMEOUT_MS = 2_147_000_000;
export const ASYNC_DETAIL_PAGE_SIZE = 50;

export function useAsyncStandings(publicationId: string) {
  const [standings, setStandings] = useState<AsyncStandings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const refreshRef = useRef<() => void>(() => {});
  const pendingRequest = useRef<{ publicationId: string; startedAt: number; promise: Promise<AsyncStandings> } | null>(null);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let pendingRefresh = false;
    let retentionExpired = false;
    let localRetentionAt = Infinity;
    let expiryTimer: number | undefined;
    setStandings(null); setLoading(true); setRefreshing(false); setError(""); setExpired(false);

    function expireIfNeeded() {
      if (retentionExpired || Date.now() < localRetentionAt) return retentionExpired;
      retentionExpired = true;
      if (expiryTimer) window.clearTimeout(expiryTimer);
      setStandings(null); setLoading(false); setExpired(true);
      setError("Die Aufbewahrungsfrist dieser Runde ist abgelaufen.");
      return true;
    }

    function scheduleExpiry(next: AsyncStandings, requestStartedAt: number) {
      if (expiryTimer) window.clearTimeout(expiryTimer);
      localRetentionAt = requestStartedAt + Math.max(0, next.retentionAt - next.updatedAt);
      function check() {
        if (!active || expireIfNeeded()) return;
        expiryTimer = window.setTimeout(check, Math.min(MAX_TIMEOUT_MS, Math.max(1, localRetentionAt - Date.now())));
      }
      check();
    }

    async function refresh(afterCurrent = false) {
      if (!active || expireIfNeeded()) return;
      if (inFlight) { pendingRefresh ||= afterCurrent; return; }
      inFlight = true;
      setRefreshing(true);
      let request = pendingRequest.current;
      if (!request || request.publicationId !== publicationId) {
        request = { publicationId, startedAt: Date.now(), promise: cloud.asyncStandings(publicationId) };
        pendingRequest.current = request;
      }
      try {
        const next = await request.promise;
        if (active && !retentionExpired) {
          scheduleExpiry(next, request.startedAt);
          if (!retentionExpired) {
            setStandings((previous) => {
              const before = new Map(previous?.publicationId === next.publicationId
                ? previous.participants.map((player) => [player.attemptId, player]) : []);
              return { ...next, participants: next.participants.map((player) => {
                const old = before.get(player.attemptId);
                return { ...player, previousRank: old?.rank ?? 0, rankChange: old ? old.rank - player.rank : 0,
                  previousPoints: old?.points ?? player.points };
              }) };
            });
            setError("");
          }
        }
      } catch (caught) {
        if (active && !expireIfNeeded()) setError(`Aktualisierung fehlgeschlagen: ${message(caught)}`);
      } finally {
        if (pendingRequest.current === request) pendingRequest.current = null;
        inFlight = false;
        if (active) {
          setLoading(false); setRefreshing(false);
          if (pendingRefresh && document.visibilityState === "visible") {
            pendingRefresh = false;
            void refresh();
          } else pendingRefresh = false;
        }
      }
    }

    const refreshVisible = () => { if (!expireIfNeeded() && document.visibilityState === "visible") void refresh(true); };
    const refreshInterval = () => { if (!expireIfNeeded() && document.visibilityState === "visible") void refresh(); };
    const offline = () => {
      if (active && !expireIfNeeded()) setError("Du bist offline. Der angezeigte Stand wird nach Wiederherstellung der Verbindung aktualisiert.");
    };
    refreshRef.current = () => { void refresh(true); };
    void refresh();
    const timer = window.setInterval(refreshInterval, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("focus", refreshVisible);
    window.addEventListener("online", refreshVisible);
    window.addEventListener("offline", offline);
    return () => {
      active = false;
      window.clearInterval(timer);
      if (expiryTimer) window.clearTimeout(expiryTimer);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener("focus", refreshVisible);
      window.removeEventListener("online", refreshVisible);
      window.removeEventListener("offline", offline);
      refreshRef.current = () => {};
    };
  }, [publicationId]);

  return {
    standings: standings?.publicationId === publicationId ? standings : null,
    loading, refreshing, error, expired, refresh: () => refreshRef.current(),
  };
}

export function matchesAsyncDetail(detail: AsyncParticipantResult | undefined, player: AsyncStandingParticipant): boolean {
  return !!detail && detail.attemptId === player.attemptId && detail.answeredCount === player.answeredCount &&
    detail.points === player.points && detail.answers.length === player.answeredCount;
}

export function useAsyncParticipantDetails(
  publicationId: string, standings: AsyncStandings | null, enabled: boolean, limit: number,
) {
  const [details, setDetails] = useState<Map<string, AsyncParticipantResult>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const context = useRef({ standings, enabled, limit });
  const syncRef = useRef<() => void>(() => {});
  const clearRef = useRef<() => void>(() => {});
  useLayoutEffect(() => { context.current = { standings, enabled, limit }; }, [standings, enabled, limit]);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let pending = false;
    const cache = new Map<string, AsyncParticipantResult>();
    setDetails(new Map()); setLoading(false); setError("");

    async function sync() {
      const current = context.current;
      if (!active || !current.enabled || current.standings?.publicationId !== publicationId) return;
      if (inFlight) { pending = true; return; }
      const missingPages = new Set<number>();
      current.standings.participants.slice(0, current.limit).forEach((player, index) => {
        if (!matchesAsyncDetail(cache.get(player.attemptId), player)) missingPages.add(Math.floor(index / ASYNC_DETAIL_PAGE_SIZE));
      });
      if (missingPages.size === 0) { setError(""); return; }
      inFlight = true;
      setLoading(true); setError("");
      try {
        for (const page of missingPages) {
          if (!active || !context.current.enabled) break;
          const result = await cloud.asyncPublicationResults(publicationId, page ? String(page * ASYNC_DETAIL_PAGE_SIZE) : undefined);
          if (!active) return;
          const latest = context.current.standings;
          if (latest?.publicationId !== publicationId) continue;
          const byId = new Map(latest.participants.map((player) => [player.attemptId, player]));
          for (const detail of result.participants) {
            const player = byId.get(detail.attemptId);
            if (player && matchesAsyncDetail(detail, player)) cache.set(detail.attemptId, detail);
          }
          setDetails(new Map(cache));
        }
        const latest = context.current;
        if (latest.enabled && latest.standings?.publicationId === publicationId &&
            latest.standings.participants.slice(0, latest.limit).some((player) => !matchesAsyncDetail(cache.get(player.attemptId), player))) {
          setError("Die Teilnehmerdetails haben sich geändert und werden beim nächsten Abgleich erneut geladen.");
        }
      } catch (caught) {
        if (active) setError(`Teilnehmerdetails konnten nicht aktualisiert werden: ${message(caught)}`);
      } finally {
        inFlight = false;
        if (active) {
          setLoading(false);
          if (pending) { pending = false; void sync(); }
        }
      }
    }

    syncRef.current = () => { void sync(); };
    clearRef.current = () => { cache.clear(); setDetails(new Map()); setError(""); };
    return () => { active = false; syncRef.current = () => {}; clearRef.current = () => {}; };
  }, [publicationId]);

  useEffect(() => {
    if (!standings) clearRef.current();
    else if (enabled && standings.publicationId === publicationId && limit > 0) syncRef.current();
  }, [standings, enabled, limit, publicationId]);
  return { details, loading, error, retry: () => syncRef.current() };
}
