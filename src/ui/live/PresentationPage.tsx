import { useParams } from "react-router-dom";
import { useLiveState } from "../../hooks/useLiveState";
import { ErrorNotice, LoadingNotice } from "../common/Notices";
import { StageLayout } from "../shell/StageLayout";
import { usePageTitle } from "../usePageTitle";
import { LiveGameView } from "./LiveGameView";
import { phaseLabel } from "./phaseLabels";
import "./live.css";

/** Shared screen of a live round (`/present/:presentationToken`) – read-only, no quizmaster actions. */
export function PresentationPage() {
  const { presentationToken = "" } = useParams();
  return <PresentationSession key={presentationToken} token={presentationToken} />;
}

function PresentationSession({ token }: { token: string }) {
  const live = useLiveState("", "presentation", token);
  const { state } = live;
  usePageTitle(state ? `${state.title} · Präsentation` : "Präsentation");
  const aside = state ? <>
    <p className="rl-live-title">{state.title}</p>
    <span className="rl-pill rl-live-phase" role="status">{phaseLabel(state.status)}</span>
  </> : undefined;
  return <StageLayout aside={aside} className="rl-live-stage">
    <ErrorNotice error={live.error}>
      <button type="button" className="rl-btn rl-btn-secondary rl-btn-small" onClick={() => live.refresh()}>
        Verbindung erneut prüfen</button>
    </ErrorNotice>
    {state ? <LiveGameView key={state.sessionId} variant="presentation" state={state} offset={live.offset} /> :
      <LoadingNotice>Präsentation wird geladen …</LoadingNotice>}
  </StageLayout>;
}
