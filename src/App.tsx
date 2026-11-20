import { useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, HardDrive, Plus, Sparkles, Trash2 } from "lucide-react";
import { exampleQuiz } from "./domain/exampleQuiz";
import { clearDrafts, newDraft, readDrafts, saveDrafts, type Draft } from "./drafts";
import { QuizEditor } from "./QuizEditor";
import type { Quiz } from "./domain/quiz";
import { CloudApp } from "./CloudApp";
import { Layout as SharedLayout, message } from "./components/Layout";
import { HomeContent } from "./components/HomeContent";
import { QuizCover } from "./components/QuizCover";
import { ImpressumPage, PrivacyPolicyPage } from "./components/LegalPages";
import { ConfirmDialog } from "./components/ConfirmDialog";

function Layout({ children }: { children: React.ReactNode }) {
  return <SharedLayout localMode>{children}</SharedLayout>;
}

function LocalNotice() {
  return <p className="local-notice"><HardDrive size={20} aria-hidden="true" />
    <span><strong>Lokaler Entwurfsmodus:</strong> Entwürfe werden erst nach deiner Aktivierung auf diesem Gerät gespeichert.
      Live-Spiele und Anmeldung sind hier nicht verfügbar.</span></p>;
}

function Home() {
  return <Layout>
    <HomeContent localMode />
  </Layout>;
}

function Overview({ storageEnabled, onStorageEnabledChange }: {
  storageEnabled: boolean;
  onStorageEnabledChange: (enabled: boolean) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!storageEnabled) {
      setDrafts([]);
      setLoaded(false);
      setError("");
      return;
    }
    setLoaded(false);
    try { setDrafts(readDrafts()); setError(""); }
    catch (caught) { setError(message(caught)); }
    finally { setLoaded(true); }
  }, [storageEnabled]);

  function save(next: Draft[]) {
    if (!storageEnabled || !loaded) return;
    try {
      saveDrafts(next);
      setDrafts(next);
      setError("");
      setNotice("");
    } catch (caught) { setError(message(caught)); }
  }

  function addExample() {
    if (!storageEnabled || !loaded) return;
    const draft = newDraft(exampleQuiz);
    try {
      saveDrafts([...drafts, draft]);
      setNotice("");
      navigate(`/admin/quizzes/${draft.id}`);
    } catch (caught) { setError(message(caught)); }
  }

  return <Layout>
    <div className="section-heading workspace-heading">
      <div><span className="eyebrow">DEINE IDEEN, DEINE BÜHNE</span><h1>Quiz-Entwürfe <span className="heading-count">{drafts.length}</span></h1>
        <p>Erstelle Fragen und bringe deine nächste Runde in Form.</p></div>
      <Link className="button primary" to="/admin/quizzes/new"><Plus size={19} /> Neues Quiz</Link>
    </div>
    <LocalNotice />
    <section className="draft-storage" aria-labelledby="draft-storage-heading">
      <h2 id="draft-storage-heading">Entwürfe auf diesem Gerät</h2>
      <p>Wenn du die Funktion einschaltest, werden vorhandene lokale Entwürfe gelesen, aber nicht verändert.
        Neue Entwürfe werden nur nach einem ausdrücklichen Speichern abgelegt und bleiben bis zum Löschen oder zum Entfernen
        der Website-Daten in diesem Browser. Ausschalten löscht nichts.</p>
      <label className="draft-storage-toggle">
        <input type="checkbox" checked={storageEnabled}
          onChange={(event) => { setNotice(""); onStorageEnabledChange(event.target.checked); }} />
        Gespeicherte Entwürfe anzeigen und lokale Speicherung aktivieren
      </label>
      {storageEnabled && <ConfirmDialog title="Alle Entwürfe löschen?"
        description="Alle lokalen Quiz-Entwürfe auf diesem Gerät werden endgültig gelöscht. Das lässt sich nicht rückgängig machen."
        confirmLabel="Alle Entwürfe löschen"
        trigger={<button className="button danger">Alle lokalen Entwürfe löschen</button>}
        onConfirm={() => {
        try {
          clearDrafts();
          setDrafts([]);
          setError("");
          setNotice("Alle lokalen Quiz-Entwürfe wurden gelöscht.");
          onStorageEnabledChange(false);
        } catch (caught) { setError(message(caught)); }
      }} />}
      {notice && <p className="draft-storage-status" role="status">{notice}</p>}
    </section>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {storageEnabled && !loaded ? <p role="status">Entwürfe werden gelesen …</p> :
      storageEnabled && drafts.length === 0 && !error ? <div className="empty">
      <Sparkles size={36} aria-hidden="true" /><h2>Hier ist noch Platz für Ideen.</h2>
      <p>Starte mit einem eigenen Quiz oder entdecke unsere zehn Beispielfragen.</p>
      <button className="button secondary" onClick={addExample}>Beispielquiz verwenden</button>
    </div> : storageEnabled && loaded && drafts.length > 0 ? <div className="grid quiz-library">
      {drafts.map((draft) => <article className="card library-card" key={draft.id}>
        <QuizCover questionCount={draft.quiz.questions.length} />
        <h2>{draft.quiz.title}</h2><p>{draft.quiz.description || "Ohne Beschreibung"}</p>
        <div className="card-actions">
          <Link className="button small secondary" to={`/admin/quizzes/${draft.id}`}>Bearbeiten</Link>
          <button className="icon-button" title="Duplizieren" aria-label={`${draft.quiz.title} duplizieren`}
            onClick={() => save([...drafts, newDraft(draft.quiz)])}><Copy size={18} /></button>
          <ConfirmDialog title="Entwurf löschen?"
            description={`„${draft.quiz.title}“ wird auf diesem Gerät endgültig gelöscht. Das lässt sich nicht rückgängig machen.`}
            confirmLabel="Entwurf löschen" onConfirm={() => save(drafts.filter((item) => item.id !== draft.id))}
            trigger={<button className="icon-button" title="Löschen" aria-label={`${draft.quiz.title} löschen`}>
              <Trash2 size={18} /></button>} />
        </div>
      </article>)}
      <button className="card add-card" onClick={addExample}><Plus size={22} /> Beispielquiz hinzufügen</button>
    </div> : !storageEnabled ? <div className="empty">
      <HardDrive size={36} aria-hidden="true" /><h2>Deine Entwürfe bleiben zunächst im Arbeitsspeicher.</h2>
      <p>Aktiviere die Speicherfunktion, um vorhandene Entwürfe anzusehen oder Entwürfe ausdrücklich auf diesem Gerät zu speichern.</p>
    </div> : null}
  </Layout>;
}

function EditorPage({ storageEnabled, onStorageEnabledChange }: {
  storageEnabled: boolean;
  onStorageEnabledChange: (enabled: boolean) => void;
}) {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [initial, setInitial] = useState<{ draft?: Draft; error: string } | null>(
    quizId === "new" ? { draft: undefined, error: "" } : null,
  );
  const [loading, setLoading] = useState(quizId !== "new");

  useEffect(() => {
    if (quizId === "new") {
      setInitial({ draft: undefined, error: "" });
      setLoading(false);
      return;
    }
    if (!storageEnabled) return;
    setLoading(true);
    try {
      const draft = readDrafts().find((item) => item.id === quizId);
      setInitial({ draft, error: draft ? "" : "Dieser Entwurf wurde nicht gefunden." });
    } catch (caught) { setInitial({ draft: undefined, error: message(caught) }); }
    finally { setLoading(false); }
  }, [quizId, storageEnabled]);

  function save(quiz: Quiz) {
    if (!storageEnabled) {
      setError("Aktiviere zuerst die lokale Speicherfunktion. Bis dahin bleibt dein Quiz nur im Arbeitsspeicher.");
      return;
    }
    try {
      const drafts = readDrafts();
      if (quizId !== "new" && !drafts.some((draft) => draft.id === quizId)) {
        throw new Error("Dieser Entwurf wurde zwischenzeitlich gelöscht.");
      }
      const existingDraft = initial?.draft;
      const draft = existingDraft ? { ...existingDraft, quiz } : newDraft(quiz);
      saveDrafts(existingDraft ? drafts.map((item) => item.id === draft.id ? draft : item) : [...drafts, draft]);
      navigate("/admin");
    } catch (caught) { setError(message(caught)); }
  }

  return <Layout><Link className="back" to="/admin"><ArrowLeft size={17} /> Zur Übersicht</Link>
    {quizId !== "new" && !storageEnabled && !initial ? <>
      <LocalNotice />
      <section className="draft-storage" aria-labelledby="existing-draft-heading">
        <h1 id="existing-draft-heading">Vorhandenen Entwurf ansehen?</h1>
        <p>Dieser Link kann einen bereits gespeicherten Entwurf öffnen. Er wird erst gelesen, wenn du die Speicherfunktion aktivierst.
          Deine vorhandenen Daten bleiben bis dahin unverändert.</p>
        <button className="button primary" onClick={() => onStorageEnabledChange(true)}>Entwurf auf diesem Gerät ansehen</button>
      </section>
    </> : loading ? <p role="status">Entwurf wird gelesen …</p> : initial ?
      initial.error ? <p role="alert" className="error-banner">{initial.error}</p> : <>
        <div className="section-heading"><div><span className="eyebrow">QUIZWERKSTATT</span>
          <h1>{initial.draft ? "Quiz bearbeiten" : "Neues Quiz"}</h1>
          <p>Eine richtige Antwort pro Frage. Den Rest erledigt die Spielfreude.</p></div></div>
        <LocalNotice />
        {error && <p className="error-banner" role="alert">{error}</p>}
        <QuizEditor initialQuiz={initial.draft?.quiz} onSave={save}
          draftStorageEnabled={storageEnabled} onDraftStorageEnabledChange={onStorageEnabledChange} />
      </> : null}
  </Layout>;
}

function Unavailable() {
  return <Layout><div className="empty">
    <h1>Live-Spiel noch nicht verfügbar</h1>
    <p>Der sichere Beitritt und das Live-Backend sind noch in Arbeit. Es werden keine Spielcodes angenommen.</p>
    <Link className="button secondary" to="/">Zur Startseite</Link>
  </div></Layout>;
}

function NotFound() {
  return <Layout><div className="empty"><h1>Seite nicht gefunden</h1>
    <Link className="button secondary" to="/">Zur Startseite</Link></div></Layout>;
}

export function App({ cloudConfigured = false }: { cloudConfigured?: boolean }) {
  const [draftStorageEnabled, setDraftStorageEnabled] = useState(false);
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname) {
      window.scrollTo(0, 0);
      document.getElementById("main-content")?.focus({ preventScroll: true });
      previousPath.current = pathname;
    }
  }, [pathname]);
  if (cloudConfigured) return <CloudApp />;
  return <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/admin" element={<Overview storageEnabled={draftStorageEnabled}
      onStorageEnabledChange={setDraftStorageEnabled} />} />
    <Route path="/admin/quizzes/:quizId" element={<EditorPage storageEnabled={draftStorageEnabled}
      onStorageEnabledChange={setDraftStorageEnabled} />} />
    <Route path="/join" element={<Unavailable />} />
    <Route path="/join/:joinCode" element={<Unavailable />} />
    <Route path="/play/:sessionId" element={<Unavailable />} />
    <Route path="/present/:presentationToken" element={<Unavailable />} />
    <Route path="/admin/sessions/:sessionId" element={<Unavailable />} />
    <Route path="/impressum" element={<Layout><ImpressumPage /></Layout>} />
    <Route path="/datenschutz" element={<Layout><PrivacyPolicyPage /></Layout>} />
    <Route path="*" element={<NotFound />} />
  </Routes>;
}
