import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, Clock, Copy, Lightbulb, ListChecks, Pencil, Play, Share2, Timer, Trash2 } from "lucide-react";
import { cloud, type QuizRecord } from "../../cloud";
import { newDraft, readDrafts, saveDrafts } from "../../drafts";
import { CATEGORY_LABELS, categoryOf } from "../../domain/categories";
import type { Quiz } from "../../domain/quiz";
import { CategoryIcon } from "../CategoryIcon";
import { categoryToneClass } from "../categories";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { message } from "../common/message";
import { ErrorNotice, LoadingNotice } from "../common/Notices";
import { StreakBonusOption } from "../game/Rewards";
import { routes } from "../routes";
import { useAppMode } from "../shell/appMode";
import { usePageTitle } from "../usePageTitle";
import { questionCountLabel } from "./dashboardStatus";
import { useDraftStorage } from "./draftStorage";
import { answerLetter } from "./editorHelpers";
import { loadDraft, type DraftLookup } from "./localDrafts";
import { ExistingDraftPage, LocalNotice } from "./LocalNotice";
import "../neu.css";
import "../quizzes.css";
import "./admin.css";

function BackLink() {
  return <Link className="rl-adm-back" to={routes.admin}><ChevronLeft aria-hidden="true" strokeWidth={3} /> Zur Übersicht</Link>;
}

/** Page frame for loading and error states, before a quiz is available. */
function DetailMessage({ children }: { children: ReactNode }) {
  usePageTitle("Quiz-Details");
  return <div className="rl-adm-page rl-adm-narrow rl-adm-detail">
    <BackLink />
    <h1 className="rl-title rl-overview-title">Quiz-Details</h1>
    {children}
  </div>;
}

function QuestionList({ quiz }: { quiz: Quiz }) {
  return <section className="rl-adm-section" aria-labelledby="quiz-questions-title">
    <div className="rl-adm-section-head"><h2 id="quiz-questions-title">Fragen im Überblick</h2></div>
    <ol className="rl-adm-question-list">
      {quiz.questions.map((question, index) => <li key={index} className="rl-adm-question">
        <div className="rl-adm-question-head">
          <span className="rl-question-row-mark" aria-hidden="true">{index + 1}</span>
          <h3><span className="rl-visually-hidden">Frage {index + 1}: </span>{question.text}</h3>
          <span className="rl-adm-question-time"><Timer aria-hidden="true" /> {question.durationSeconds} s
            <span className="rl-visually-hidden"> Antwortzeit</span></span>
        </div>
        <ul className="rl-adm-answer-list" aria-label={`Antworten zu Frage ${index + 1}`}>
          {question.answers.map((answer, answerIndex) =>
            <li key={answerIndex} className={`rl-adm-answer${answer.correct ? " is-correct" : ""}`}>
              <span className="rl-adm-answer-letter" aria-hidden="true">{answerLetter(answerIndex)}</span>
              <span className="rl-adm-answer-text">{answer.text}</span>
              {answer.correct && <><Check aria-hidden="true" strokeWidth={3.4} />
                <span className="rl-visually-hidden"> (richtige Antwort)</span></>}
            </li>)}
        </ul>
        {question.explanation && <p className="rl-adm-explanation"><Lightbulb aria-hidden="true" />
          <span><span className="rl-visually-hidden">Erklärung: </span>{question.explanation}</span></p>}
      </li>)}
    </ol>
  </section>;
}

/** Shared detail layout: summary card, mode specific actions and the question list. */
function DetailView({ quiz, notices, primary, secondary }: {
  quiz: Quiz; notices?: ReactNode; primary?: ReactNode; secondary: ReactNode;
}) {
  usePageTitle(quiz.title);
  const total = quiz.questions.reduce((sum, question) => sum + question.durationSeconds, 0);
  const average = quiz.questions.length ? Math.round(total / quiz.questions.length) : 0;
  return <div className="rl-adm-page rl-adm-narrow rl-adm-detail">
    <BackLink />
    {notices}
    <section className={`rl-summary ${categoryToneClass(quiz.category)}`} aria-labelledby="quiz-detail-title">
      <div className="rl-summary-head">
        <span className="rl-adm-detail-icon"><CategoryIcon category={quiz.category} /></span>
        <div className="rl-summary-text">
          <span className="rl-eyebrow">QUIZ-DETAILS</span>
          <h1 id="quiz-detail-title" className="rl-summary-title">{quiz.title}</h1>
          <p className="rl-summary-category">{CATEGORY_LABELS[categoryOf(quiz.category)]}</p>
        </div>
      </div>
      {quiz.description && <p className="rl-summary-description">{quiz.description}</p>}
      <ul className="rl-summary-chips" aria-label="Eckdaten">
        <li><ListChecks aria-hidden="true" />{questionCountLabel(quiz.questions.length)}</li>
        <li><Timer aria-hidden="true" />Ø {average} s Antwortzeit</li>
        <li><Clock aria-hidden="true" />≈ {Math.max(1, Math.ceil(total / 60))} Min. Fragezeit</li>
      </ul>
    </section>
    {primary && <div className="rl-adm-primary-actions">{primary}</div>}
    <div className="rl-detail-actions">{secondary}</div>
    <QuestionList quiz={quiz} />
  </div>;
}

function CloudDetail({ quizId }: { quizId: string }) {
  const navigate = useNavigate();
  const [record, setRecord] = useState<QuizRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [streakBonus, setStreakBonus] = useState(false);
  useEffect(() => {
    let active = true;
    cloud.getQuiz(quizId).then((value) => { if (active) setRecord(value); },
      (caught) => { if (active) setError(message(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quizId]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (caught) { setError(message(caught)); } finally { setBusy(false); }
  }

  if (loading) return <DetailMessage><LoadingNotice>Quiz wird geladen …</LoadingNotice></DetailMessage>;
  if (!record) return <DetailMessage><ErrorNotice error={error || "Dieses Quiz wurde nicht gefunden."} /></DetailMessage>;
  const { quiz } = record;
  return <DetailView quiz={quiz} notices={<ErrorNotice error={error} />}
    primary={<>
      <div className="rl-adm-live-start">
        <button type="button" className="rl-btn rl-btn-primary rl-btn-block" disabled={busy} onClick={() => void run(async () => {
          const session = await cloud.createSession(record.quizId, streakBonus);
          void navigate(routes.session(session.sessionId));
        })}><Play aria-hidden="true" fill="currentColor" strokeWidth={0} /> Live-Quiz starten</button>
        <details className="live-start-options rl-details"><summary>Live-Spielregeln</summary>
          <div className="rl-details-body">
            <StreakBonusOption enabled={streakBonus} disabled={busy} onChange={setStreakBonus} />
          </div>
        </details>
      </div>
      <Link className="rl-btn rl-btn-secondary rl-btn-block" to={routes.publish(record.quizId)}>
        <Share2 aria-hidden="true" /> Als Quiz zum Mitmachen veröffentlichen</Link>
    </>}
    secondary={<>
      <Link className="rl-chip-button" to={routes.editQuiz(record.quizId)}><Pencil aria-hidden="true" /> Bearbeiten</Link>
      <button type="button" className="rl-chip-button" disabled={busy} onClick={() => void run(async () => {
        const copy = await cloud.duplicateQuiz(record.quizId);
        void navigate(routes.quiz(copy.quizId));
      })}><Copy aria-hidden="true" /> Duplizieren</button>
      <ConfirmDialog title="Quiz löschen?" confirmLabel="Quiz löschen" confirmDisabled={busy}
        description={`„${quiz.title}“ wird endgültig gelöscht. Das lässt sich nicht rückgängig machen.`}
        onConfirm={() => void run(async () => {
          await cloud.deleteQuiz(record.quizId, record.version);
          void navigate(routes.admin);
        })}
        trigger={<button type="button" className="rl-chip-button is-danger-soft" disabled={busy}>
          <Trash2 aria-hidden="true" /> Löschen</button>} />
    </>} />;
}

function LocalDetail({ quizId }: { quizId: string }) {
  const navigate = useNavigate();
  const { enabled, setEnabled } = useDraftStorage();
  const [lookup, setLookup] = useState<DraftLookup | null>(() => enabled ? loadDraft(quizId) : null);
  const [error, setError] = useState("");

  if (!lookup) return <ExistingDraftPage onEnable={() => { setEnabled(true); setLookup(loadDraft(quizId)); }} />;
  const { draft } = lookup;
  if (!draft) return <DetailMessage><LocalNotice /><ErrorNotice error={lookup.error} /></DetailMessage>;

  function update(change: () => string) {
    setError("");
    try { void navigate(change()); } catch (caught) { setError(message(caught)); }
  }
  return <DetailView quiz={draft.quiz} notices={<><LocalNotice /><ErrorNotice error={error} /></>}
    primary={<Link className="rl-btn rl-btn-primary rl-btn-block" to={routes.editQuiz(draft.id)}>
      <Pencil aria-hidden="true" /> Bearbeiten</Link>}
    secondary={<>
      <button type="button" className="rl-chip-button" onClick={() => update(() => {
        const copy = newDraft(draft.quiz);
        saveDrafts([...readDrafts(), copy]);
        return routes.quiz(copy.id);
      })}><Copy aria-hidden="true" /> Duplizieren</button>
      <ConfirmDialog title="Entwurf löschen?" confirmLabel="Entwurf löschen"
        description={`„${draft.quiz.title}“ wird auf diesem Gerät endgültig gelöscht. Das lässt sich nicht rückgängig machen.`}
        onConfirm={() => update(() => {
          saveDrafts(readDrafts().filter((item) => item.id !== draft.id));
          return routes.admin;
        })}
        trigger={<button type="button" className="rl-chip-button is-danger-soft"><Trash2 aria-hidden="true" /> Löschen</button>} />
    </>} />;
}

/** `/admin/quizzes/:quizId`: read-only overview of a quiz with its actions (both app modes). */
export function QuizDetailPage() {
  const { quizId = "" } = useParams();
  const { cloud: cloudMode } = useAppMode();
  return cloudMode ? <CloudDetail key={quizId} quizId={quizId} /> : <LocalDetail key={quizId} quizId={quizId} />;
}
