import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  GENERATION_DIFFICULTIES, GENERATION_MAX_QUESTIONS, GENERATION_TONES, defaultGenerationRequest, generationRequestSchema,
  type GenerationRequest,
} from "./domain/quizGeneration";
import { Button } from "./components/ui/button";

function FieldError({ message, id }: { message?: string; id: string }) {
  return message ? <span id={id} className="field-error" role="alert">{message}</span> : null;
}

const difficultyLabels: Record<GenerationRequest["difficulty"], string> = {
  leicht: "Leicht", mittel: "Mittel", schwer: "Schwer", gemischt: "Gemischt",
};
const toneLabels: Record<GenerationRequest["tone"], string> = { sachlich: "Sachlich", locker: "Locker", humorvoll: "Humorvoll" };

export function QuizGeneratorForm({ onGenerate, busy }: { onGenerate: (request: GenerationRequest) => void; busy: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm<GenerationRequest>({
    resolver: zodResolver(generationRequestSchema), defaultValues: defaultGenerationRequest(),
  });
  const described = (name: keyof GenerationRequest) => errors[name] ? { "aria-invalid": true, "aria-describedby": `generate-${name}-error` } : {};
  return <form className="question-card generator-form" onSubmit={handleSubmit(onGenerate)} noValidate aria-label="Quiz mit KI erstellen">
    <fieldset disabled={busy}>
      <div className="generator-grid">
        <label className="field">Quiztitel
          <input maxLength={120} placeholder="Zum Beispiel: Rund um den Weltraum" {...described("title")} {...register("title")} />
          <FieldError id="generate-title-error" message={errors.title?.message} />
        </label>
        <label className="field">Thema
          <input maxLength={300} placeholder="Zum Beispiel: Planeten unseres Sonnensystems" {...described("topic")} {...register("topic")} />
          <FieldError id="generate-topic-error" message={errors.topic?.message} />
        </label>
        <label className="field">Anzahl Fragen
          <input type="number" min={1} max={GENERATION_MAX_QUESTIONS} {...described("questionCount")}
            {...register("questionCount", { valueAsNumber: true })} />
          <FieldError id="generate-questionCount-error" message={errors.questionCount?.message} />
        </label>
        <label className="field">Antwortmöglichkeiten pro Frage
          <input type="number" min={2} max={8} {...described("answerCount")} {...register("answerCount", { valueAsNumber: true })} />
          <FieldError id="generate-answerCount-error" message={errors.answerCount?.message} />
        </label>
        <label className="field">Schwierigkeit
          <select {...register("difficulty")}>
            {GENERATION_DIFFICULTIES.map((value) => <option key={value} value={value}>{difficultyLabels[value]}</option>)}
          </select>
        </label>
        <label className="field">Tonalität
          <select {...register("tone")}>
            {GENERATION_TONES.map((value) => <option key={value} value={value}>{toneLabels[value]}</option>)}
          </select>
        </label>
        <label className="field"><span>Zielgruppe <span className="hint">(optional)</span></span>
          <input maxLength={120} placeholder="Zum Beispiel: Kinder ab 10, Kollegium, Fachpublikum" {...described("audience")}
            {...register("audience")} />
          <FieldError id="generate-audience-error" message={errors.audience?.message} />
        </label>
        <label className="field">Sprache
          <input maxLength={40} {...described("language")} {...register("language")} />
          <FieldError id="generate-language-error" message={errors.language?.message} />
        </label>
        <label className="field">Antwortzeit in Sekunden
          <input type="number" min={5} max={120} {...described("durationSeconds")} {...register("durationSeconds", { valueAsNumber: true })} />
          <FieldError id="generate-durationSeconds-error" message={errors.durationSeconds?.message} />
        </label>
        <label className="generator-toggle">
          <input type="checkbox" {...register("includeExplanations")} /> Erklärungen zu den Lösungen erzeugen
        </label>
      </div>
      <label className="field"><span>Zusätzliche Hinweise <span className="hint">(optional)</span></span>
        <textarea rows={4} maxLength={4000} placeholder="Schwerpunkte, Ausschlüsse oder eigener Text, aus dem die Fragen entstehen sollen"
          {...described("notes")} {...register("notes")} />
        <FieldError id="generate-notes-error" message={errors.notes?.message} />
      </label>
      <p className="hint">Deine Angaben werden zur Erstellung an OpenAI übermittelt. Bitte keine personenbezogenen oder vertraulichen
        Daten eingeben. KI-Inhalte können Fehler enthalten – prüfe Fragen und Lösungen vor dem Speichern.</p>
      <Button type="submit" className="button primary" disabled={busy}><Sparkles size={18} aria-hidden="true" />
        {busy ? "Quiz wird erstellt …" : "Quiz erstellen lassen"}</Button>
    </fieldset>
  </form>;
}
