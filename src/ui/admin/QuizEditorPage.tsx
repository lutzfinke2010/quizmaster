import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { cloud, type QuizRecord } from "../../cloud";
import { newDraft, readDrafts, saveDrafts } from "../../drafts";
import { quizSchema, type Quiz } from "../../domain/quiz";
import { message } from "../common/message";
import { ErrorNotice, LoadingNotice } from "../common/Notices";
import { routes } from "../routes";
import { useAppMode } from "../shell/appMode";
import { useDraftStorage } from "./draftStorage";
import { EditorFrame } from "./EditorFrame";
import { loadDraft, type DraftLookup } from "./localDrafts";
import { ExistingDraftPage, LocalNotice } from "./LocalNotice";
import { QuizForm } from "./QuizForm";
import "./admin.css";

function CloudEditor({ quizId }: { quizId?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [generatedQuiz] = useState(() => {
    const state: unknown = location.state;
    if (quizId || !state || typeof state !== "object" || !("generatedQuiz" in state)) return undefined;
    const parsed = quizSchema.safeParse(state.generatedQuiz);
    return parsed.success ? parsed.data : undefined;
  });
  const [record, setRecord] = useState<QuizRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(quizId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!quizId) return;
    let active = true;
    cloud.getQuiz(quizId).then((value) => { if (active) setRecord(value); },
      (caught) => { if (active) setError(message(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quizId]);
  async function save(quiz: Quiz) {
    setSaving(true); setError("");
    try {
      if (record) await cloud.updateQuiz(record.quizId, record.version, quiz); else await cloud.createQuiz(quiz);
      void navigate(routes.admin);
    } catch (caught) { setError(message(caught)); } finally { setSaving(false); }
  }
  const showForm = !loading && (!quizId || record);
  return <EditorFrame title={quizId ? "Quiz bearbeiten" : "Neues Quiz"}
    lead="Deine Ideen werden zur nächsten Lieblingsrunde. Eine richtige Antwort pro Frage.">
    {generatedQuiz && !record && <div className="rl-adm-editor-notices">
      <p role="status" className="rl-notice rl-notice-info">Dieser Entwurf wurde von einer KI erstellt.
        Bitte prüfe Fragen, richtige Antworten und Erklärungen, bevor du das Quiz speicherst.</p>
    </div>}
    {loading && <div className="rl-adm-editor-notices rl-adm-editor-gate"><LoadingNotice>Quiz wird geladen …</LoadingNotice></div>}
    {!loading && !showForm && <div className="rl-adm-editor-notices rl-adm-editor-gate"><ErrorNotice error={error} /></div>}
    {showForm && <QuizForm initialQuiz={record?.quiz ?? generatedQuiz} onSave={(quiz) => void save(quiz)} saving={saving}
      cloudMode error={error} initialStep={generatedQuiz && !record ? 2 : 1} />}
  </EditorFrame>;
}

function LocalEditor({ quizId }: { quizId?: string }) {
  const navigate = useNavigate();
  const { enabled, setEnabled } = useDraftStorage();
  const [error, setError] = useState("");
  const [initial, setInitial] = useState<DraftLookup | null>(() =>
    !quizId ? { draft: undefined, error: "" } : enabled ? loadDraft(quizId) : null);

  function save(quiz: Quiz) {
    if (!enabled) {
      setError("Aktiviere zuerst die lokale Speicherfunktion. Bis dahin bleibt dein Quiz nur im Arbeitsspeicher.");
      return;
    }
    try {
      const drafts = readDrafts();
      if (quizId && !drafts.some((draft) => draft.id === quizId)) {
        throw new Error("Dieser Entwurf wurde zwischenzeitlich gelöscht.");
      }
      const existingDraft = initial?.draft;
      const draft = existingDraft ? { ...existingDraft, quiz } : newDraft(quiz);
      saveDrafts(existingDraft ? drafts.map((item) => item.id === draft.id ? draft : item) : [...drafts, draft]);
      void navigate(routes.admin);
    } catch (caught) { setError(message(caught)); }
  }

  if (quizId && !initial) {
    return <ExistingDraftPage onEnable={() => { setEnabled(true); setInitial(loadDraft(quizId)); }} />;
  }
  if (initial?.error) {
    return <EditorFrame title="Quiz bearbeiten">
      <div className="rl-adm-editor-notices rl-adm-editor-gate"><ErrorNotice error={initial.error} /></div>
    </EditorFrame>;
  }
  return <EditorFrame title={initial?.draft ? "Quiz bearbeiten" : "Neues Quiz"}
    lead="Eine richtige Antwort pro Frage. Den Rest erledigt die Spielfreude.">
    <div className="rl-adm-editor-notices"><LocalNotice /></div>
    <QuizForm initialQuiz={initial?.draft?.quiz} onSave={save} error={error}
      draftStorageEnabled={enabled} onDraftStorageEnabledChange={setEnabled} />
  </EditorFrame>;
}

/** `/admin/quizzes/new` and `/admin/quizzes/:quizId/bearbeiten` in both app modes. */
export function QuizEditorPage() {
  const { quizId } = useParams();
  const { cloud: cloudMode } = useAppMode();
  return cloudMode
    ? <CloudEditor key={quizId ?? "new"} quizId={quizId} />
    : <LocalEditor key={quizId ?? "new"} quizId={quizId} />;
}
