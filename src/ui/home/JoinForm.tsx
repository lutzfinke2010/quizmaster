import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { cloud } from "../../cloud";
import { normalizeJoinCodeInput } from "../../shareLinks";
import { ErrorNotice } from "../common/Notices";
import { message } from "../common/message";
import { routes } from "../routes";

/** Quiz code entry for live and async rounds. The server decides which mode a code belongs to. */
export function JoinForm({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const inputId = useId();
  const hintId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeJoinCodeInput(code);
    if (normalized.error) { setError(normalized.error); return; }
    setBusy(true); setError("");
    try {
      const resolved = await cloud.resolveJoinCode(normalized.code);
      if (resolved.mode === "ASYNC") { navigate(routes.asyncQuiz(resolved.joinCode)); return; }
      const participant = await cloud.join(resolved.joinCode);
      navigate(routes.play(participant.sessionId));
    }
    catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }

  return <form className="rl-join-form" onSubmit={(event) => void submit(event)} noValidate>
    <ErrorNotice error={error} />
    <label className="rl-join-label" htmlFor={inputId}>Quiz-Code</label>
    <input id={inputId} className="rl-code-input" type="text" inputMode="numeric" autoComplete="off" autoCorrect="off"
      spellCheck={false} maxLength={12} required value={code} placeholder="482 619" disabled={busy}
      aria-describedby={hintId} aria-invalid={error ? true : undefined}
      onChange={(event) => { setCode(event.target.value); if (error) setError(""); }} />
    <p className="rl-hint" id={hintId}>Den Code bekommst du von deinem Quizmaster, z. B. 482 619.</p>
    <button type="submit" className={`rl-start-button${busy ? " is-celebrating" : ""}`} disabled={busy}>
      {busy
        ? <><LoaderCircle className="rl-spin" aria-hidden="true" />Wird geprüft …</>
        : <>Los geht’s <ArrowRight strokeWidth={3} aria-hidden="true" /></>}
    </button>
  </form>;
}
