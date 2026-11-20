import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Check, CheckCircle2, CircleHelp, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormProvider, useFieldArray, useForm, useFormContext, useWatch } from "react-hook-form";
import { newQuestion, quizSchema, type Quiz } from "./domain/quiz";
import { Button } from "./components/ui/button";
import { ConfirmDialog } from "./components/ConfirmDialog";

function FieldError({ message, id }: { message?: string; id: string }) {
  return message ? <span id={id} className="field-error" role="alert">{message}</span> : null;
}

function QuestionFields({ index, total, move, remove }: {
  index: number;
  total: number;
  move: (from: number, to: number) => void;
  remove: (index: number) => void;
}) {
  const { control, register, setValue, trigger, formState: { errors } } = useFormContext<Quiz>();
  const { fields, append, remove: removeAnswer, move: moveAnswer } = useFieldArray({
    control, name: `questions.${index}.answers`,
  });
  const answers = useWatch({ control, name: `questions.${index}.answers` });
  const questionError = errors.questions?.[index];
  const answerError = questionError?.answers;
  const correctIndex = answers?.findIndex((answer) => answer.correct) ?? -1;
  const errorId = `question-${index}-error`;
  const groupError = answerError?.root?.message ?? answerError?.message;

  function chooseCorrect(selected: number) {
    fields.forEach((_, answerIndex) =>
      setValue(`questions.${index}.answers.${answerIndex}.correct`, answerIndex === selected, { shouldDirty: true }),
    );
    void trigger(`questions.${index}.answers`);
  }

  return <section className="question-card" id={`question-${index + 1}`} aria-labelledby={`question-${index}-heading`} tabIndex={-1}>
    <div className="question-heading">
      <h2 id={`question-${index}-heading`}><span className="question-number" aria-hidden="true">{index + 1}</span> Frage {index + 1}</h2>
      <div className="reorder">
        <button type="button" className="icon-button" disabled={index === 0} onClick={() => move(index, index - 1)}
          aria-label={`Frage ${index + 1} nach oben`}><ArrowUp size={18} /></button>
        <button type="button" className="icon-button" disabled={index === total - 1} onClick={() => move(index, index + 1)}
          aria-label={`Frage ${index + 1} nach unten`}><ArrowDown size={18} /></button>
        <button type="button" className="icon-button" disabled={total <= 1} onClick={() => remove(index)}
          aria-label={`Frage ${index + 1} löschen`}><Trash2 size={18} /></button>
      </div>
    </div>
    <label className="field">Fragetext
      <input maxLength={500} placeholder="Was möchtest du wissen?" aria-invalid={Boolean(questionError?.text)}
        aria-describedby={questionError?.text ? `${errorId}-text` : undefined} {...register(`questions.${index}.text`)} />
      <FieldError id={`${errorId}-text`} message={questionError?.text?.message} />
    </label>
    <fieldset className="answers" aria-describedby={groupError ? `${errorId}-answers` : undefined}>
      <legend>Antworten <span className="hint">Markiere genau eine richtige Lösung mit dem Auswahlkreis.</span></legend>
      <FieldError id={`${errorId}-answers`} message={groupError} />
      {fields.map((field, answerIndex) => <div className={`answer-row${answers?.[answerIndex]?.correct ? " is-correct" : ""}`} key={field.id}>
        <label className="correct-choice" title="Als richtige Antwort markieren">
          <input type="radio" name={`correct-${index}`} checked={answers?.[answerIndex]?.correct ?? false}
            onChange={() => chooseCorrect(answerIndex)}
            aria-invalid={Boolean(groupError)} aria-describedby={groupError ? `${errorId}-answers` : undefined}
            aria-label={`Antwort ${answerIndex + 1} bei Frage ${index + 1} ist richtig`} />
          <span>{String.fromCharCode(65 + answerIndex)}</span>
          {answers?.[answerIndex]?.correct && <span className="correct-indicator" aria-hidden="true"><Check size={12} /> Richtig</span>}
        </label>
        <div className="answer-input">
          <input aria-label={`Antwort ${answerIndex + 1} bei Frage ${index + 1}`} maxLength={200}
            aria-invalid={Boolean(answerError?.[answerIndex]?.text)}
            aria-describedby={answerError?.[answerIndex]?.text ? `${errorId}-answer-${answerIndex}` : undefined}
            placeholder={`Antwort ${String.fromCharCode(65 + answerIndex)}`}
            {...register(`questions.${index}.answers.${answerIndex}.text`)} />
          <FieldError id={`${errorId}-answer-${answerIndex}`} message={answerError?.[answerIndex]?.text?.message} />
        </div>
        <div className="answer-tools">
        <button type="button" className="icon-button compact" disabled={answerIndex === 0}
          aria-label={`Antwort ${answerIndex + 1} nach oben`}
          onClick={() => moveAnswer(answerIndex, answerIndex - 1)}><ArrowUp size={16} /></button>
        <button type="button" className="icon-button compact" disabled={answerIndex === fields.length - 1}
          aria-label={`Antwort ${answerIndex + 1} nach unten`}
          onClick={() => moveAnswer(answerIndex, answerIndex + 1)}><ArrowDown size={16} /></button>
        <button type="button" className="icon-button compact" disabled={fields.length <= 2}
          aria-label={`Antwort ${answerIndex + 1} löschen`} onClick={() => removeAnswer(answerIndex)}>
          <Trash2 size={16} />
        </button>
        </div>
      </div>)}
      <p className={`selection-summary${correctIndex < 0 ? " is-empty" : ""}`} role="status" aria-atomic="true">
        {correctIndex < 0 ? <><CircleHelp size={18} aria-hidden="true" /><span>Noch keine richtige Antwort ausgewählt.</span></> :
          <><CheckCircle2 size={18} aria-hidden="true" /><span><strong>Richtige Antwort: {String.fromCharCode(65 + correctIndex)}</strong>
            {answers?.[correctIndex]?.text ? ` · ${answers[correctIndex].text}` : " · Antworttext noch ergänzen"}</span></>}
      </p>
      <button type="button" className="text-button" disabled={fields.length >= 8}
        onClick={() => append({ text: "", correct: false })}><Plus size={16} /> Antwort hinzufügen</button>
    </fieldset>
    <div className="question-details">
      <label className="field">Antwortzeit in Sekunden
        <input type="number" min={5} max={120} aria-invalid={Boolean(questionError?.durationSeconds)}
          aria-describedby={questionError?.durationSeconds ? `${errorId}-duration` : undefined}
          {...register(`questions.${index}.durationSeconds`, { valueAsNumber: true })} />
        <FieldError id={`${errorId}-duration`} message={questionError?.durationSeconds?.message} />
      </label>
      <label className="field"><span>Erklärung <span className="hint">(optional)</span></span>
        <textarea maxLength={1000} rows={2} placeholder="Eine kurze Erklärung für die Auflösung"
          aria-invalid={Boolean(questionError?.explanation)} aria-describedby={questionError?.explanation ? `${errorId}-explanation` : undefined}
          {...register(`questions.${index}.explanation`)} />
        <FieldError id={`${errorId}-explanation`} message={questionError?.explanation?.message} />
      </label>
    </div>
  </section>;
}

export function QuizEditor({ initialQuiz, onSave, saving = false, cloudMode = false, draftStorageEnabled = false,
  onDraftStorageEnabledChange }: {
  initialQuiz?: Quiz;
  onSave: (quiz: Quiz) => void;
  saving?: boolean;
  cloudMode?: boolean;
  draftStorageEnabled?: boolean;
  onDraftStorageEnabledChange?: (enabled: boolean) => void;
}) {
  const form = useForm<Quiz>({
    resolver: zodResolver(quizSchema),
    defaultValues: initialQuiz ?? { title: "", description: "", questions: [newQuestion()] },
  });
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: "questions" });
  const questions = useWatch({ control: form.control, name: "questions" });
  const chosenCount = questions.filter((question) => question.answers.some((answer) => answer.correct)).length;
  const isDirty = form.formState.isDirty;
  const navigate = useNavigate();
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    if (cloudMode || !isDirty) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function confirmNavigation(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a");
      if (!link || link.target || link.hasAttribute("download")) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin ||
          (destination.pathname === window.location.pathname && destination.search === window.location.search)) return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(destination.pathname + destination.search + destination.hash);
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", confirmNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", confirmNavigation, true);
    };
  }, [cloudMode, isDirty]);

  return <FormProvider {...form}>
    <ConfirmDialog title="Änderungen verwerfen?" variant="warning"
      description="Deine Änderungen sind noch nicht gespeichert. Wenn du die Seite verlässt, gehen sie verloren."
      confirmLabel="Änderungen verwerfen" open={destination !== null}
      onOpenChange={(open) => { if (!open) setDestination(null); }}
      onConfirm={() => { if (destination !== null) void navigate(destination); }} />
    <form onSubmit={form.handleSubmit(onSave)} noValidate className="editor-layout" aria-label="Quiz bearbeiten">
      <aside className="editor-outline" aria-label="Quizübersicht">
        <span className="eyebrow">DEIN QUIZ IM BLICK</span>
        <h2>{fields.length} {fields.length === 1 ? "Frage" : "Fragen"}</h2>
        <progress className="editor-progress" value={chosenCount} max={Math.max(1, fields.length)} aria-label="Fragen mit gewählter Lösung" />
        <p>{chosenCount} von {fields.length} Lösungen gewählt. Zum Bearbeiten eine Frage öffnen.</p>
        <nav aria-label="Fragen im Quiz"><ol className="outline-list">
          {questions.map((question, index) => {
            const correctIndex = question.answers.findIndex((answer) => answer.correct);
            return <li key={fields[index]?.id ?? index}><a className={`outline-link${correctIndex >= 0 ? " has-selection" : ""}`}
              href={`#question-${index + 1}`}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span><strong>{question.text || `Frage ${index + 1}`}</strong>
                <small>{correctIndex < 0 ? "Lösung noch offen" :
                  `✓ ${String.fromCharCode(65 + correctIndex)} · ${question.answers[correctIndex].text || "Text noch offen"}`}</small></span>
            </a></li>;
          })}
        </ol></nav>
      </aside>
      <div className="editor-content">
      <section className="question-card">
        <h2 className="metadata-heading">Gib deiner Runde einen Namen.</h2>
        <div className="metadata">
          <label className="field">Quiztitel
            <input maxLength={120} placeholder="Zum Beispiel: Die große Feierabendrunde" aria-invalid={Boolean(form.formState.errors.title)}
              aria-describedby={form.formState.errors.title ? "quiz-title-error" : undefined} {...form.register("title")} />
            <FieldError id="quiz-title-error" message={form.formState.errors.title?.message} />
          </label>
          <label className="field"><span>Beschreibung <span className="hint">(optional)</span></span>
            <input maxLength={500} placeholder="Worum geht es?" aria-invalid={Boolean(form.formState.errors.description)}
              aria-describedby={form.formState.errors.description ? "quiz-description-error" : undefined} {...form.register("description")} />
            <FieldError id="quiz-description-error" message={form.formState.errors.description?.message} />
          </label>
        </div>
      </section>
      {fields.map((field, index) => <QuestionFields key={`${field.id}-${index}`} index={index} total={fields.length}
        move={move} remove={remove} />)}
      <FieldError id="quiz-questions-error" message={form.formState.errors.questions?.root?.message ?? form.formState.errors.questions?.message} />
      <div className="editor-actions">
        <button type="button" className="button secondary" disabled={fields.length >= 100}
          onClick={() => append(newQuestion())}><Plus size={18} /> Frage hinzufügen</button>
        {!cloudMode && <div className="draft-storage-editor">
          <label className="draft-storage-toggle">
            <input type="checkbox" checked={draftStorageEnabled ?? false}
              onChange={(event) => onDraftStorageEnabledChange?.(event.target.checked)} />
            Quiz-Entwürfe auf diesem Gerät speichern
          </label>
          <p>Erst nach dem Einschalten werden Entwürfe beim Klick auf „Entwurf speichern“ dauerhaft in diesem Browser abgelegt.
            Bereits vorhandene Entwürfe bleiben erhalten; Ausschalten löscht sie nicht. Die Auswahl betrifft nur diese Speicherfunktion.</p>
        </div>}
        <Button type="submit" className="button primary" disabled={saving}><Save size={18} />
          {saving ? "Wird gespeichert …" : cloudMode ? "Quiz speichern" : "Entwurf speichern"}</Button>
        <p className="save-note">{cloudMode ? "Änderungen werden erst beim Speichern übernommen." :
          draftStorageEnabled ? "Dein Entwurf wird nach dem Speichern nur in diesem Browser abgelegt." :
            "Ohne Aktivierung bleibt dein Quiz nur im Arbeitsspeicher und geht beim Verlassen verloren."}</p>
      </div>
      </div>
    </form>
  </FormProvider>;
}
