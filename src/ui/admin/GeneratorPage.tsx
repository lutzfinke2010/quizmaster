import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ChevronDown, Sparkles } from "lucide-react";
import { cloud } from "../../cloud";
import {
  GENERATION_DIFFICULTIES, GENERATION_MAX_QUESTIONS, GENERATION_TONES, defaultGenerationRequest, generationRequestSchema,
  type GenerationRequest,
} from "../../domain/quizGeneration";
import { message } from "../common/message";
import { ErrorNotice, LoadingNotice } from "../common/Notices";
import { Meadow } from "../CreateIllustrations";
import { LlamaCharacter } from "../LlamaCharacter";
import { routes } from "../routes";
import { EditorFrame } from "./EditorFrame";
import { FieldError } from "./FieldError";
import "../neu.css";
import "../quizzes.css";
import "./admin.css";

const GENERATION_POLL_MS = 3_000;
const GENERATION_MAX_WAIT_MS = 17 * 60_000;

const difficultyLabels: Record<GenerationRequest["difficulty"], string> = {
  leicht: "Leicht", mittel: "Mittel", schwer: "Schwer", gemischt: "Gemischt",
};
const toneLabels: Record<GenerationRequest["tone"], string> = { sachlich: "Sachlich", locker: "Locker", humorvoll: "Humorvoll" };

function GeneratorForm({ onGenerate, busy }: { onGenerate: (request: GenerationRequest) => void; busy: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm<GenerationRequest>({
    resolver: zodResolver(generationRequestSchema), defaultValues: defaultGenerationRequest(),
  });
  const described = (name: keyof GenerationRequest) => errors[name] ? { "aria-invalid": true, "aria-describedby": `generate-${name}-error` } : {};
  return <form className="rl-adm-generator" onSubmit={handleSubmit(onGenerate)} noValidate aria-label="Quiz mit KI erstellen">
    <fieldset disabled={busy}>
      <div className="rl-form-card">
        <div className="rl-field">
          <label className="rl-field-label" htmlFor="generate-title">Quiztitel</label>
          <input id="generate-title" className="rl-input" maxLength={120} placeholder="Zum Beispiel: Rund um den Weltraum"
            {...described("title")} {...register("title")} />
          <FieldError id="generate-title-error" message={errors.title?.message} />
        </div>
        <div className="rl-field">
          <label className="rl-field-label" htmlFor="generate-topic">Thema</label>
          <input id="generate-topic" className="rl-input" maxLength={300} placeholder="Zum Beispiel: Planeten unseres Sonnensystems"
            {...described("topic")} {...register("topic")} />
          <FieldError id="generate-topic-error" message={errors.topic?.message} />
        </div>
        <div className="rl-adm-gen-grid">
          <div className="rl-field">
            <label className="rl-field-label" htmlFor="generate-question-count">Anzahl Fragen</label>
            <input id="generate-question-count" className="rl-input" type="number" min={1} max={GENERATION_MAX_QUESTIONS}
              inputMode="numeric" {...described("questionCount")} {...register("questionCount", { valueAsNumber: true })} />
            <FieldError id="generate-questionCount-error" message={errors.questionCount?.message} />
          </div>
          <div className="rl-field">
            <label className="rl-field-label" htmlFor="generate-answer-count">Antwortmöglichkeiten pro Frage</label>
            <input id="generate-answer-count" className="rl-input" type="number" min={2} max={8} inputMode="numeric"
              {...described("answerCount")} {...register("answerCount", { valueAsNumber: true })} />
            <FieldError id="generate-answerCount-error" message={errors.answerCount?.message} />
          </div>
          <div className="rl-field">
            <label className="rl-field-label" htmlFor="generate-difficulty">Schwierigkeit</label>
            <div className="rl-select">
              <select id="generate-difficulty" className="rl-input" {...register("difficulty")}>
                {GENERATION_DIFFICULTIES.map((value) => <option key={value} value={value}>{difficultyLabels[value]}</option>)}
              </select>
              <ChevronDown className="rl-select-chevron" aria-hidden="true" strokeWidth={3} />
            </div>
          </div>
          <div className="rl-field">
            <label className="rl-field-label" htmlFor="generate-tone">Tonalität</label>
            <div className="rl-select">
              <select id="generate-tone" className="rl-input" {...register("tone")}>
                {GENERATION_TONES.map((value) => <option key={value} value={value}>{toneLabels[value]}</option>)}
              </select>
              <ChevronDown className="rl-select-chevron" aria-hidden="true" strokeWidth={3} />
            </div>
          </div>
          <div className="rl-field">
            <label className="rl-field-label" htmlFor="generate-audience">
              Zielgruppe <span className="rl-field-optional">optional</span></label>
            <input id="generate-audience" className="rl-input" maxLength={120}
              placeholder="Zum Beispiel: Kinder ab 10, Kollegium, Fachpublikum" {...described("audience")} {...register("audience")} />
            <FieldError id="generate-audience-error" message={errors.audience?.message} />
          </div>
          <div className="rl-field">
            <label className="rl-field-label" htmlFor="generate-language">Sprache</label>
            <input id="generate-language" className="rl-input" maxLength={40} {...described("language")} {...register("language")} />
            <FieldError id="generate-language-error" message={errors.language?.message} />
          </div>
          <div className="rl-field">
            <label className="rl-field-label" htmlFor="generate-duration">Antwortzeit in Sekunden</label>
            <input id="generate-duration" className="rl-input" type="number" min={5} max={120} inputMode="numeric"
              {...described("durationSeconds")} {...register("durationSeconds", { valueAsNumber: true })} />
            <FieldError id="generate-durationSeconds-error" message={errors.durationSeconds?.message} />
          </div>
        </div>
        <label className="rl-checkbox">
          <input type="checkbox" {...register("includeExplanations")} /> Erklärungen zu den Lösungen erzeugen
        </label>
        <div className="rl-field">
          <label className="rl-field-label" htmlFor="generate-notes">
            Zusätzliche Hinweise <span className="rl-field-optional">optional</span></label>
          <textarea id="generate-notes" className="rl-input rl-textarea" rows={4} maxLength={4000}
            placeholder="Schwerpunkte, Ausschlüsse oder eigener Text, aus dem die Fragen entstehen sollen"
            {...described("notes")} {...register("notes")} />
          <FieldError id="generate-notes-error" message={errors.notes?.message} />
        </div>
        <p className="rl-hint">Deine Angaben werden zur Erstellung an OpenAI übermittelt. Bitte keine personenbezogenen oder vertraulichen
          Daten eingeben. KI-Inhalte können Fehler enthalten – prüfe Fragen und Lösungen vor dem Speichern.</p>
      </div>
      <footer className="rl-editor-footer">
        <Meadow className="rl-editor-meadow" />
        <LlamaCharacter key={busy ? "busy" : "idle"} mood={busy ? "surprised" : "curious"} className="rl-editor-llama" />
        <div className="rl-editor-action">
          <button type="submit" className="rl-start-button rl-editor-button" disabled={busy}>
            <Sparkles strokeWidth={2.6} aria-hidden="true" />{busy ? "Quiz wird erstellt …" : "Quiz erstellen lassen"}</button>
        </div>
      </footer>
    </fieldset>
  </form>;
}

/** `/admin/quizzes/generate` (cloud only): AI quiz draft, opened in the editor for review afterwards. */
export function GeneratorPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeRef = useRef(true);
  useEffect(() => { activeRef.current = true; return () => { activeRef.current = false; }; }, []);
  async function generate(request: GenerationRequest) {
    setBusy(true); setError("");
    try {
      let job = await cloud.startQuizGeneration(request);
      const started = Date.now();
      while (job.status === "PENDING") {
        if (Date.now() - started > GENERATION_MAX_WAIT_MS) throw new Error("Die KI-Generierung dauert zu lange. Bitte versuche es erneut.");
        await new Promise((resolve) => setTimeout(resolve, GENERATION_POLL_MS));
        if (!activeRef.current) return;
        job = await cloud.getQuizGeneration(job.jobId);
      }
      if (job.status === "FAILED" || !job.quiz) throw new Error(job.error || "Die KI-Generierung ist fehlgeschlagen.");
      if (activeRef.current) void navigate(routes.newQuiz, { state: { generatedQuiz: job.quiz } });
    } catch (caught) {
      if (activeRef.current) setError(message(caught));
    } finally {
      if (activeRef.current) setBusy(false);
    }
  }
  return <EditorFrame title="Quiz mit KI erstellen"
    lead="Beschreibe dein Wunschquiz. Der Vorschlag öffnet sich anschließend im Editor, wo du ihn prüfen und speichern kannst.">
    {(error || busy) && <div className="rl-adm-editor-notices">
      <ErrorNotice error={error} />
      {busy && <LoadingNotice>Die KI schreibt deine Fragen. Das kann je nach Umfang bis zu einigen Minuten dauern …</LoadingNotice>}
    </div>}
    <GeneratorForm onGenerate={(request) => void generate(request)} busy={busy} />
  </EditorFrame>;
}
