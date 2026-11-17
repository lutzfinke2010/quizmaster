import { useEffect, useRef, useState } from "react";
import { Hub } from "aws-amplify/utils";
import { ConnectionState, CONNECTION_STATE_CHANGE } from "aws-amplify/api";
import { cloud, type GameState } from "../cloud";
import { message } from "../components/Layout";
import { classifyLiveEvent } from "./liveEvents";

export type LiveMode = "admin" | "guest" | "presentation";

const PHASE_RELOAD_DELAY_MS = 250;
const PARTICIPANT_RELOAD_DELAY_MS = 1_000;
const PARTICIPANT_RELOAD_JITTER_MS = 1_000;

/**
 * Hält den Spielstand per Subscription aktuell. Phasenwechsel (`version`) lösen einen Reload aus; Zählerstände
 * aus Events werden lokal übernommen. Geänderte Teilnehmendenzahlen laden die Spielerliste gedrosselt und mit
 * Jitter nach, damit eine volle Lobby nicht bei jedem Beitritt alle Clients gleichzeitig nachladen lässt.
 */
export function useLiveState(sessionId: string, mode: LiveMode, token?: string) {
  const [state, setState] = useState<GameState | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [recoveryVersion, setRecoveryVersion] = useState(0);
  const current = useRef<GameState | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!sessionId && !token) return;
    let resolvedSessionId = sessionId;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let backoff = 1000;
    let subscription: ReturnType<typeof cloud.subscribe> | undefined;
    let eventRefresh: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let again = false;
    let wantedVersion = -1;
    current.current = null;
    setState(null); setError(""); setConnectionError("");
    function apply(next: GameState) {
      current.current = next; setState(next);
    }
    function schedule() {
      if (!active || retry) return;
      retry = setTimeout(() => { retry = undefined; connect(); void refresh(); }, backoff);
      backoff = Math.min(backoff * 2, 30_000);
    }
    function scheduleRefresh(delay: number) {
      if (eventRefresh) return;
      eventRefresh = setTimeout(() => { eventRefresh = undefined; void refresh(); }, delay);
    }
    async function refresh() {
      if (inFlight) { again = true; return; }
      inFlight = true;
      try {
        const start = Date.now();
        const next = token ? await cloud.presentation(token) : await cloud.gameState(sessionId, mode === "admin" ? "admin" : "guest");
        const end = Date.now();
        if (!active) return;
        if (resolvedSessionId && next.sessionId !== resolvedSessionId) throw new Error("Unerwartete Sitzung im Spielstand.");
        if (!resolvedSessionId) { resolvedSessionId = next.sessionId; connect(); }
        if (next.version >= (current.current?.version ?? -1)) {
          apply(next); setOffset(next.serverTime - (start + end) / 2);
        }
        setError("");
        if (next.version < wantedVersion) again = true;
      } catch (caught) { if (active) { setError(`Verbindung unterbrochen: ${message(caught)}`); schedule(); } }
      finally {
        inFlight = false;
        if (active && again) { again = false; void refresh(); }
      }
    }
    function connect() {
      if (!resolvedSessionId) return;
      subscription?.unsubscribe();
      subscription = cloud.subscribe(resolvedSessionId, mode === "admin" ? "admin" : "guest", token ?? null,
        (event) => {
          backoff = 1000; setConnectionError(""); wantedVersion = Math.max(wantedVersion, event.version);
          const action = classifyLiveEvent(current.current, event);
          if (action.kind === "reload") scheduleRefresh(PHASE_RELOAD_DELAY_MS);
          else if (action.kind === "patch") {
            apply(action.state);
            if (action.reloadParticipants) scheduleRefresh(PARTICIPANT_RELOAD_DELAY_MS + Math.random() * PARTICIPANT_RELOAD_JITTER_MS);
          }
        },
        (caught) => { if (active) { setConnectionError(`Echtzeitverbindung unterbrochen: ${message(caught)}`); schedule(); } });
    }
    const cancelHub = Hub.listen("api", ({ payload }) => {
      if (payload.event === CONNECTION_STATE_CHANGE && payload.data && typeof payload.data === "object" &&
          "connectionState" in payload.data && payload.data.connectionState === ConnectionState.Connected) {
        backoff = 1000; setConnectionError(""); setRecoveryVersion((value) => value + 1); void refresh();
      }
    });
    function reconnect() {
      backoff = 1000; setConnectionError(""); connect(); void refresh(); setRecoveryVersion((value) => value + 1);
    }
    function offline() { setConnectionError("Du bist offline. Sobald die Verbindung zurück ist, wird der Spielstand erneut geladen."); }
    window.addEventListener("offline", offline);
    window.addEventListener("online", reconnect);
    refreshRef.current = () => { void refresh(); };
    connect(); void refresh();
    return () => { active = false; if (retry) clearTimeout(retry); if (eventRefresh) clearTimeout(eventRefresh);
      subscription?.unsubscribe(); cancelHub();
      window.removeEventListener("offline", offline); window.removeEventListener("online", reconnect); };
  }, [sessionId, mode, token]);
  return { state: token || state?.sessionId === sessionId ? state : null, offset, error: connectionError || error,
    recoveryVersion, refresh: () => refreshRef.current() };
}
