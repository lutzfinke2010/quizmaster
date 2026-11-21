import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Plus, Sparkles, Trash2 } from "lucide-react";
import { CATEGORY_LABELS, categoryOf } from "../../domain/categories";
import { exampleQuiz } from "../../domain/exampleQuiz";
import { clearDrafts, newDraft, saveDrafts, type Draft } from "../../drafts";
import { CategoryIcon } from "../CategoryIcon";
import { categoryToneClass } from "../categories";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { message } from "../common/message";
import { ErrorNotice } from "../common/Notices";
import { BookStack } from "../OverviewIllustrations";
import { RateLamaMascot } from "../RateLamaMascot";
import { routes } from "../routes";
import { usePageTitle } from "../usePageTitle";
import { useDraftStorage } from "./draftStorage";
import { questionCountLabel } from "./dashboardStatus";
import { EMPTY_LIBRARY, loadDrafts, type DraftLibrary } from "./localDrafts";
import { LocalNotice } from "./LocalNotice";
import "../neu.css";
import "../overview.css";
import "../quizzes.css";
import "./admin.css";

/** Local draft mode overview. localStorage is only touched after the explicit opt-in. */
export function LocalDashboardPage() {
  usePageTitle("Quiz-Entwürfe");
  const { enabled, setEnabled } = useDraftStorage();
  const [library, setLibrary] = useState<DraftLibrary>(() => enabled ? loadDrafts() : EMPTY_LIBRARY);
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();
  const { drafts, error } = library;

  function changeStorage(next: boolean) {
    setNotice("");
    setEnabled(next);
    setLibrary(next ? loadDrafts() : EMPTY_LIBRARY);
  }

  function save(next: Draft[]) {
    if (!enabled) return;
    try {
      saveDrafts(next);
      setLibrary({ drafts: next, error: "" });
      setNotice("");
    } catch (caught) { setLibrary((current) => ({ ...current, error: message(caught) })); }
  }

  function addExample() {
    if (!enabled) return;
    const draft = newDraft(exampleQuiz);
    try {
      saveDrafts([...drafts, draft]);
      setNotice("");
      navigate(routes.editQuiz(draft.id));
    } catch (caught) { setLibrary((current) => ({ ...current, error: message(caught) })); }
  }

  function clearAll() {
    try {
      clearDrafts();
      setLibrary(EMPTY_LIBRARY);
      setNotice("Alle lokalen Quiz-Entwürfe wurden gelöscht.");
      setEnabled(false);
    } catch (caught) { setLibrary((current) => ({ ...current, error: message(caught) })); }
  }

  return <div className="rl-adm-page">
    <header className="rl-overview-header rl-adm-header">
      <div className="rl-adm-header-text">
        <span className="rl-eyebrow">DEINE IDEEN, DEINE BÜHNE</span>
        <h1 className="rl-title rl-overview-title">Quiz-Entwürfe <span className="rl-adm-count">{drafts.length}</span></h1>
        <p className="rl-overview-lead">Erstelle Fragen und bringe deine nächste Runde in Form.</p>
        <div className="rl-adm-header-actions">
          <Link className="rl-new-quiz-button" to={routes.newQuiz}>
            <span className="rl-new-quiz-plus" aria-hidden="true"><Plus strokeWidth={3.4} /></span>Neues Quiz
          </Link>
        </div>
      </div>
      <RateLamaMascot state="intro" size={200} decorative className="rl-adm-header-art" />
    </header>
    <LocalNotice />
    <section className="rl-card rl-adm-storage" aria-labelledby="draft-storage-heading">
      <h2 id="draft-storage-heading">Entwürfe auf diesem Gerät</h2>
      <p>Wenn du die Funktion einschaltest, werden vorhandene lokale Entwürfe gelesen, aber nicht verändert.
        Neue Entwürfe werden nur nach einem ausdrücklichen Speichern abgelegt und bleiben bis zum Löschen oder zum Entfernen
        der Website-Daten in diesem Browser. Ausschalten löscht nichts.</p>
      <label className="rl-checkbox">
        <input type="checkbox" checked={enabled} onChange={(event) => changeStorage(event.target.checked)} />
        Gespeicherte Entwürfe anzeigen und lokale Speicherung aktivieren
      </label>
      {enabled && <div className="rl-actions">
        <ConfirmDialog title="Alle Entwürfe löschen?"
          description="Alle lokalen Quiz-Entwürfe auf diesem Gerät werden endgültig gelöscht. Das lässt sich nicht rückgängig machen."
          confirmLabel="Alle Entwürfe löschen" onConfirm={clearAll}
          trigger={<button type="button" className="rl-btn rl-btn-danger-soft">
            <Trash2 aria-hidden="true" /> Alle lokalen Entwürfe löschen</button>} />
      </div>}
      {notice && <p className="rl-notice rl-notice-success" role="status">{notice}</p>}
    </section>
    <ErrorNotice error={error} />
    {enabled && drafts.length === 0 && !error ? <div className="rl-empty rl-adm-empty">
      <RateLamaMascot state="intro" size={124} decorative className="rl-adm-empty-art" />
      <h2>Hier ist noch Platz für Ideen.</h2>
      <p>Starte mit einem eigenen Quiz oder entdecke unsere zehn Beispielfragen.</p>
      <button type="button" className="rl-btn rl-btn-secondary" onClick={addExample}>
        <Sparkles aria-hidden="true" /> Beispielquiz verwenden</button>
    </div> : enabled && drafts.length > 0 ? <div className="grid quiz-library">
      {drafts.map((draft) => <article className={`card library-card ${categoryToneClass(draft.quiz.category)}`} key={draft.id}>
        <div className="quiz-cover">
          <span className="rl-adm-quiz-icon"><CategoryIcon category={draft.quiz.category} /></span>
          <span className="badge">{questionCountLabel(draft.quiz.questions.length)}</span>
        </div>
        <h2><Link to={routes.quiz(draft.id)}>{draft.quiz.title}</Link></h2>
        <p className="rl-adm-quiz-category">{CATEGORY_LABELS[categoryOf(draft.quiz.category)]}</p>
        <p className="rl-adm-quiz-desc">{draft.quiz.description || "Ohne Beschreibung"}</p>
        <div className="rl-adm-card-actions">
          <Link className="rl-btn rl-btn-secondary rl-btn-small" to={routes.editQuiz(draft.id)}>Bearbeiten</Link>
          <button type="button" className="rl-icon-btn" title="Duplizieren" aria-label={`${draft.quiz.title} duplizieren`}
            onClick={() => save([...drafts, newDraft(draft.quiz)])}><Copy aria-hidden="true" /></button>
          <ConfirmDialog title="Entwurf löschen?"
            description={`„${draft.quiz.title}“ wird auf diesem Gerät endgültig gelöscht. Das lässt sich nicht rückgängig machen.`}
            confirmLabel="Entwurf löschen" onConfirm={() => save(drafts.filter((item) => item.id !== draft.id))}
            trigger={<button type="button" className="rl-icon-btn is-danger" title="Löschen" aria-label={`${draft.quiz.title} löschen`}>
              <Trash2 aria-hidden="true" /></button>} />
        </div>
      </article>)}
      <button type="button" className="card rl-adm-add-card" onClick={addExample}>
        <Plus aria-hidden="true" /> Beispielquiz hinzufügen</button>
    </div> : !enabled ? <div className="rl-empty rl-adm-empty">
      <BookStack className="rl-adm-empty-art" />
      <h2>Deine Entwürfe bleiben zunächst im Arbeitsspeicher.</h2>
      <p>Aktiviere die Speicherfunktion, um vorhandene Entwürfe anzusehen oder Entwürfe ausdrücklich auf diesem Gerät zu speichern.</p>
    </div> : null}
  </div>;
}
