import { Link, useParams } from "react-router-dom";
import { ErrorNotice, LoadingNotice } from "../common/Notices";
import { ScorePill } from "../Feedback";
import { routes } from "../routes";
import { ScreenLayout } from "../shell/ScreenLayout";
import { usePageTitle } from "../usePageTitle";
import { DeleteOwnData } from "./DeleteOwnData";
import { LiveGameView } from "./LiveGameView";
import { activeStatuses, phaseLabel, standingInfo } from "./phaseLabels";
import { usePlayerSession } from "./usePlayerSession";
import "./live.css";

/** Live round on the participant's phone (`/play/:sessionId`). */
export function LivePlayerPage() {
  const { sessionId = "" } = useParams();
  return <PlayerSession key={sessionId} sessionId={sessionId} />;
}

function PlayerSession({ sessionId }: { sessionId: string }) {
  const session = usePlayerSession(sessionId);
  const { state, participant, result, standing } = session;
  usePageTitle(state?.title ?? "Live-Runde");
  if (session.deleted) {
    return <ScreenLayout>
      <section className="rl-live-deleted rl-stack" aria-labelledby="deleted-title">
        <h1 id="deleted-title" className="rl-h1">Deine Spieldaten wurden gelöscht</h1>
        <p className="rl-lead">Teilnahme, Antworten und Punkte wurden entfernt. Die technische Browser-Kennung bleibt bis zu ihrem
          Ablauf bestehen, damit sie für andere offene Spielrunden verfügbar bleibt.</p>
        <Link className="rl-btn rl-btn-primary rl-btn-block" to={routes.home}>Zur Startseite</Link>
      </section>
    </ScreenLayout>;
  }
  const score = state ? standingInfo(state, participant, result, standing).score : undefined;
  const aside = state ? <>
    <ScorePill score={score ?? 0} />
    <span className="rl-pill rl-live-phase" role="status">{phaseLabel(state.status)}</span>
  </> : undefined;
  const question = Boolean(state && activeStatuses.includes(state.status) && state.question);
  return <ScreenLayout size={question ? "play" : "phone"} aside={aside} className="rl-live-screen">
    <ErrorNotice error={session.error}>
      {session.retry && <button type="button" className="rl-btn rl-btn-secondary rl-btn-small" onClick={session.retry.run}>
        {session.retry.label}</button>}
    </ErrorNotice>
    {state ? <LiveGameView key={`${state.sessionId}:${participant?.participantId ?? "loading"}`} variant="personal"
      state={state} offset={session.offset} participant={participant} standing={standing} selected={session.selected}
      pendingChoice={session.pendingChoice} answerBusy={session.answerBusy} answerRestoreFailed={session.answerRestoreFailed}
      onAnswer={session.answer} result={result} /> : <LoadingNotice>Spielstand wird geladen …</LoadingNotice>}
    {state && participant && <DeleteOwnData sessionId={sessionId} status={state.status} onDeleted={session.markDeleted} />}
  </ScreenLayout>;
}
