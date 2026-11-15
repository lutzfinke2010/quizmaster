import { useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, HardDrive, Plus, Sparkles, Trash2 } from "lucide-react";
import { exampleQuiz } from "./domain/exampleQuiz";
import { newDraft, readDrafts, saveDrafts, type Draft } from "./drafts";
import { QuizEditor } from "./QuizEditor";
import type { Quiz } from "./domain/quiz";
import { CloudApp } from "./CloudApp";
import { Layout as SharedLayout, message } from "./components/Layout";
import { HomeContent } from "./components/HomeContent";
import { ImpressumPage, PrivacyPolicyPage } from "./components/LegalPages";

function Layout({ children }: { children: React.ReactNode }) {
  return <SharedLayout localMode>{children}</SharedLayout>;
}

function LocalNotice() {
  return <p className="local-notice"><HardDrive size={20} aria-hidden="true" />
    <span><strong>Lokaler Entwurfsmodus:</strong> Quizze werden nur in diesem Browser gespeichert. Live-Spiele und Anmeldung sind hier nicht verfügbar.</span></p>;
}

function Home() {
  return <Layout>
    <HomeContent localMode />
  </Layout>;
}

function Overview() {
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    try { return readDrafts(); } catch { return []; }
  });
  const [error, setError] = useState(() => {
    try { readDrafts(); return ""; } catch (caught) { return message(caught); }
  });
  const navigate = useNavigate();

  function save(next: Draft[]) {
    try {
      saveDrafts(next);
      setDrafts(next);
      setError("");
    } catch (caught) { setError(message(caught)); }
  }

  function addExample() {
    const draft = newDraft(exampleQuiz);
    try {
      saveDrafts([...drafts, draft]);
      navigate(`/admin/quizzes/${draft.id}`);
    } catch (caught) { setError(message(caught)); }
  }

  return <Layout>
    <div className="section-heading">
      <div><span className="eyebrow">DEINE IDEEN, DEINE BÜHNE</span><h1>Quiz-Entwürfe <span className="heading-count">{drafts.length}</span></h1>
        <p>Erstelle Fragen und bringe deine nächste Runde in Form.</p></div>
      <Link className="button primary" to="/admin/quizzes/new"><Plus size={19} /> Neues Quiz</Link>
    </div>
    <LocalNotice />
    {error && <p className="error-banner" role="alert">{error}</p>}
    {drafts.length === 0 && !error ? <div className="empty">
      <Sparkles size={36} aria-hidden="true" /><h2>Hier ist noch Platz für Ideen.</h2>
      <p>Starte mit einem eigenen Quiz oder entdecke unsere zehn Beispielfragen.</p>
      <button className="button secondary" onClick={addExample}>Beispielquiz verwenden</button>
    </div> : <div className="grid">
      {drafts.map((draft) => <article className="card" key={draft.id}>
        <span className="badge">{draft.quiz.questions.length} Fragen</span>
        <h2>{draft.quiz.title}</h2><p>{draft.quiz.description || "Ohne Beschreibung"}</p>
        <div className="card-actions">
          <Link className="button small secondary" to={`/admin/quizzes/${draft.id}`}>Bearbeiten</Link>
          <button className="icon-button" title="Duplizieren" aria-label={`${draft.quiz.title} duplizieren`}
            onClick={() => save([...drafts, newDraft(draft.quiz)])}><Copy size={18} /></button>
          <button className="icon-button" title="Löschen" aria-label={`${draft.quiz.title} löschen`}
            onClick={() => {
              if (window.confirm(`„${draft.quiz.title}“ wirklich löschen?`)) {
                save(drafts.filter((item) => item.id !== draft.id));
              }
            }}><Trash2 size={18} /></button>
        </div>
      </article>)}
      <button className="card add-card" onClick={addExample}><Plus size={22} /> Beispielquiz hinzufügen</button>
    </div>}
  </Layout>;
}

function EditorPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [initial] = useState(() => {
    try {
      if (quizId === "new") return { draft: undefined, error: "" };
      const draft = readDrafts().find((item) => item.id === quizId);
      return { draft, error: draft ? "" : "Dieser Entwurf wurde nicht gefunden." };
    } catch (caught) { return { draft: undefined, error: message(caught) }; }
  });

  function save(quiz: Quiz) {
    try {
      const drafts = readDrafts();
      if (quizId !== "new" && !drafts.some((draft) => draft.id === quizId)) {
        throw new Error("Dieser Entwurf wurde zwischenzeitlich gelöscht.");
      }
      const draft = initial.draft ? { ...initial.draft, quiz } : newDraft(quiz);
      saveDrafts(initial.draft ? drafts.map((item) => item.id === draft.id ? draft : item) : [...drafts, draft]);
      navigate("/admin");
    } catch (caught) { setError(message(caught)); }
  }

  return <Layout><Link className="back" to="/admin"><ArrowLeft size={17} /> Zur Übersicht</Link>
    {initial.error ? <p role="alert" className="error-banner">{initial.error}</p> : <>
      <div className="section-heading"><div><span className="eyebrow">QUIZWERKSTATT</span>
        <h1>{initial.draft ? "Quiz bearbeiten" : "Neues Quiz"}</h1>
        <p>Eine richtige Antwort pro Frage. Den Rest erledigt die Spielfreude.</p></div></div>
      <LocalNotice />
      {error && <p className="error-banner" role="alert">{error}</p>}
      <QuizEditor initialQuiz={initial.draft?.quiz} onSave={save} />
    </>}
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
    <Route path="/admin" element={<Overview />} />
    <Route path="/admin/quizzes/:quizId" element={<EditorPage />} />
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
