import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Maximize2 } from "lucide-react";
import type { AsyncStandings } from "../cloud";
import { Avatar, Podium } from "./GameView";
import { AnimatedPoints, Finale, RankRise, useFinaleTransition } from "./Gamification";
import { motion, useReducedMotion } from "motion/react";

const PAGE_INTERVAL_MS = 8_000;
const ROW_HEIGHT_WITH_GAP = 70;

export function AsyncStandingsPresentation({ standings, statusText, formatPoints, error, refreshing, onRefresh, onPresentationChange }: {
  standings: AsyncStandings;
  statusText: string;
  formatPoints: (points: number) => string;
  error: string;
  refreshing: boolean;
  onRefresh: () => void;
  onPresentationChange: (open: boolean) => void;
}) {
  const reduced = useReducedMotion();
  const [presenting, setPresenting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hint, setHint] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [position, setPosition] = useState({ start: 0, page: 1 });
  const [paused, setPaused] = useState(false);
  const celebrateFinal = useFinaleTransition(standings.isFinal, presenting && !error);
  const stage = useRef<HTMLDivElement>(null);
  const listArea = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasFullscreen = useRef(false);
  const remainingCount = Math.max(0, standings.participants.length - 3);
  const currentStart = remainingCount <= capacity || position.start >= remainingCount ? 0 : position.start;
  const currentPage = currentStart === 0 ? 1 : position.page;
  const rows = useMemo(() => standings.participants.slice(3 + currentStart, 3 + currentStart + capacity),
    [standings.participants, currentStart, capacity]);
  const rotation = useRef({ remainingCount, capacity });

  useLayoutEffect(() => { rotation.current = { remainingCount, capacity }; }, [remainingCount, capacity]);

  useEffect(() => {
    function syncFullscreen() {
      const current = document.fullscreenElement === stage.current;
      setFullscreen(current);
      if (current) wasFullscreen.current = true;
      else if (wasFullscreen.current) {
        wasFullscreen.current = false;
        setPresenting(false);
        onPresentationChange(false);
        window.requestAnimationFrame(() => trigger.current?.focus());
      }
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, [onPresentationChange]);

  useEffect(() => {
    if (!presenting) return;
    const area = listArea.current;
    if (!area) return;
    const measure = () => setCapacity(window.matchMedia("(max-width: 700px), (max-height: 560px)").matches
      ? 1 : Math.max(1, Math.floor((area.clientHeight + 6) / ROW_HEIGHT_WITH_GAP)));
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(area);
    window.addEventListener("resize", measure);
    measure();
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [presenting]);

  useLayoutEffect(() => {
    const area = listArea.current;
    if (presenting && area && rows.length > 1 && area.scrollHeight > area.clientHeight + 1 && capacity > 1) {
      setCapacity((value) => Math.max(1, value - 1));
    }
  }, [presenting, capacity, rows]);

  useEffect(() => {
    if (!presenting || paused) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const { remainingCount: count, capacity: size } = rotation.current;
      setPosition((previous) => {
        if (count <= size) return previous.start === 0 ? previous : { start: 0, page: 1 };
        const start = previous.start < count ? previous.start : 0;
        const next = start + size;
        return next < count ? { start: next, page: (start === 0 ? 1 : previous.page) + 1 } : { start: 0, page: 1 };
      });
    }, PAGE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [presenting, paused]);

  useEffect(() => {
    if (!presenting) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.fullscreenElement !== stage.current) {
        setPresenting(false);
        onPresentationChange(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [presenting, onPresentationChange]);

  async function open() {
    flushSync(() => {
      setHint(""); setPosition({ start: 0, page: 1 }); setPaused(false); setPresenting(true); onPresentationChange(true);
    });
    const target = stage.current;
    if (!document.fullscreenEnabled || !target?.requestFullscreen) {
      setHint("Vollbild wird von diesem Browser nicht unterstützt. Nutze die Vollbildfunktion des Browsers.");
      closeButton.current?.focus({ preventScroll: true });
      return;
    }
    try { await target.requestFullscreen(); }
    catch { setHint("Vollbild konnte nicht gestartet werden. Nutze die Vollbildfunktion des Browsers."); }
    finally { closeButton.current?.focus({ preventScroll: true }); }
  }

  async function close() {
    if (document.fullscreenElement === stage.current) {
      try { await document.exitFullscreen(); }
      catch { setHint("Vollbild konnte nicht beendet werden. Nutze die Escape-Taste oder die Vollbildfunktion des Browsers."); }
      return;
    }
    setPresenting(false); onPresentationChange(false);
    window.requestAnimationFrame(() => trigger.current?.focus());
  }

  const podium = standings.participants.slice(0, 3).map((player) => ({ ...player, participantId: player.attemptId }));
  return <>
    <button ref={trigger} type="button" className="button secondary small" onClick={() => void open()}>
      <Maximize2 size={16} aria-hidden="true" />Vollbild anzeigen
    </button>
    <div ref={stage} className="async-presentation" hidden={!presenting} role="region" aria-label="Ergebnispräsentation">
      {presenting && <div className="game-view async-presentation-board">
        <header className="async-presentation-header">
          <div><p className="async-presentation-title">{standings.title}</p>
            <h1>{standings.isFinal ? "Endstand" : "Zwischenstand"}</h1></div>
          <div className="async-presentation-meta">
            <strong>{standings.isFinal ? statusText : "Vorläufig"}</strong>
            <span>{standings.participantCount} gestartet · {standings.completedCount} abgeschlossen</span>
            <span>Stand: {new Date(standings.updatedAt).toLocaleTimeString("de-DE")}</span>
          </div>
        </header>
        {error && <div className="async-presentation-error" role="alert">{error}
          {" "}<button className="button secondary small" disabled={refreshing} onClick={onRefresh}>Erneut versuchen</button>
        </div>}
        {hint && <p className="async-presentation-hint" role="status">{hint}</p>}
        {standings.isFinal && podium.length > 0 &&
          <Finale shared celebrate={celebrateFinal} eventId={`${standings.publicationId}:presentation:finale`} />}
        {!standings.isFinal && (standings.participants[0]?.rankChange ?? 0) > 0 &&
          (standings.participants[0]?.previousRank ?? 0) > 1 &&
          <RankRise change={standings.participants[0].rankChange ?? 0}
            eventId={`${standings.publicationId}:leader:${standings.updatedAt}`} celebrate />}
        {podium.length === 0 ? <p className="async-presentation-empty">Noch keine Teilnehmenden.</p> :
          <Podium players={podium} final={standings.isFinal} formatPoints={formatPoints} />}
        <div ref={listArea} className="async-presentation-list-area">
          {rows.length > 0 && <ol className="async-presentation-list" aria-label="Weitere Plätze" aria-live="off">
            {rows.map((player) => <motion.li key={player.attemptId} layout={!reduced}
              initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .3 }}>
              <span className="async-presentation-rank" aria-label={`Rang ${player.rank}`}>{player.rank}.</span>
              <Avatar avatarId={player.avatarId} />
              <strong className="async-presentation-name">{player.displayName}</strong>
              <span className="async-presentation-points"><AnimatedPoints value={player.points} format={formatPoints} /> Punkte</span>
            </motion.li>)}
          </ol>}
        </div>
        <footer className="async-presentation-controls">
          <span>{remainingCount > 0 ?
            `Weitere Plätze · Seite ${currentPage} · Einträge ${currentStart + 4}–${currentStart + rows.length + 3} von ${standings.participants.length}`
            : "Noch keine weiteren Plätze"}</span>
          <div className="actions">
            {remainingCount > capacity && <button className="button secondary small" onClick={() => setPaused((value) => !value)}>
              {paused ? "Seitenwechsel fortsetzen" : "Seitenwechsel pausieren"}
            </button>}
            <button ref={closeButton} className="button secondary small" onClick={() => void close()}>
              {fullscreen ? "Vollbild beenden" : "Zur Adminansicht"}
            </button>
          </div>
        </footer>
      </div>}
    </div>
  </>;
}
