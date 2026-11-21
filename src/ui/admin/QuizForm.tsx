import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useFieldArray, useForm, useFormContext, useWatch, type FieldErrors } from "react-hook-form";
import {
  ArrowDown, ArrowRight, ArrowUp, Check, CheckCircle2, ChevronDown, CircleHelp, FileText, Layers, Lightbulb,
  Pencil, Plus, Save, Timer, Trash2,
} from "lucide-react";
import { CATEGORY_LABELS, DEFAULT_CATEGORY, QUIZ_CATEGORIES } from "../../domain/categories";
import { newQuestion, quizSchema, type Quiz } from "../../domain/quiz";
import { CategoryIcon } from "../CategoryIcon";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { ErrorNotice } from "../common/Notices";
import { Meadow, QuestionBubble } from "../CreateIllustrations";
import { LlamaCharacter } from "../LlamaCharacter";
import { FieldError } from "./FieldError";
import { answerLetter, basicsComplete, BASICS_FIELDS, questionComplete, type EditorStep } from "./editorHelpers";
import "../neu.css";
import "../quizzes.css";
import "./admin.css";

const STEPS: Array<{ step: 1 | 2 | 3; label: string }> = [
  { step: 1, label: "Grundlagen" }, { step: 2, label: "Fragen" }, { step: 3, label: "Fertig" },
];

function Stepper({ current, done, onSelect }: {
  current: EditorStep; done: Record<1 | 2 | 3, boolean>; onSelect: (step: EditorStep) => void;
}) {
  return <nav className="rl-stepper rl-adm-stepper" aria-label="Schritte">
    <ol>
      {STEPS.map(({ step, label }) => {
        const isCurrent = step === current;
        const state = isCurrent ? "is-current" : done[step] ? "is-done" : "is-upcoming";
        const content = <>
          <span className="rl-step-dot" aria-hidden="true">{done[step] ? <Check strokeWidth={4} /> : step}</span>
          <span className="rl-step-label">{label}</span>
          {done[step] && !isCurrent && <span className="rl-visually-hidden"> (erledigt)</span>}
        </>;
        return <li key={step} className={`rl-step ${state}`}>
          {step === 3
            ? <span className="rl-step-body">{content}</span>
            : <button type="button" className="rl-step-body" aria-current={isCurrent ? "step" : undefined}
              onClick={() => onSelect(step)}>{content}</button>}
        </li>;
      })}
    </ol>
  </nav>;
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
  const number = index + 1;

  function chooseCorrect(selected: number) {
    fields.forEach((_, answerIndex) =>
      setValue(`questions.${index}.answers.${answerIndex}.correct`, answerIndex === selected, { shouldDirty: true }),
    );
    void trigger(`questions.${index}.answers`);
  }

  return <section className={`rl-qe-card${questionError ? " has-error" : ""}`} id={`question-${number}`}
    aria-labelledby={`question-${index}-heading`} tabIndex={-1}>
    <div className="rl-adm-qe-head">
      <h2 id={`question-${index}-heading`}>Frage {number}</h2>
      <div className="rl-adm-tools">
        <button type="button" className="rl-adm-tool" disabled={index === 0} onClick={() => move(index, index - 1)}
          aria-label={`Frage ${number} nach oben`}><ArrowUp aria-hidden="true" strokeWidth={2.6} /></button>
        <button type="button" className="rl-adm-tool" disabled={index === total - 1} onClick={() => move(index, index + 1)}
          aria-label={`Frage ${number} nach unten`}><ArrowDown aria-hidden="true" strokeWidth={2.6} /></button>
        <button type="button" className="rl-adm-tool is-danger" disabled={total <= 1} onClick={() => remove(index)}
          aria-label={`Frage ${number} löschen`}><Trash2 aria-hidden="true" strokeWidth={2.4} /></button>
      </div>
    </div>
    <div className="rl-qe-question">
      <QuestionBubble className="rl-qe-bubble" />
      <div className="rl-adm-qe-text">
        <label className="rl-visually-hidden" htmlFor={`question-${index}-text`}>Fragetext</label>
        <textarea id={`question-${index}-text`} className="rl-qe-question-input" rows={2} maxLength={500}
          placeholder="Was möchtest du wissen?" aria-invalid={Boolean(questionError?.text)}
          aria-describedby={questionError?.text ? `${errorId}-text` : undefined} {...register(`questions.${index}.text`)} />
        <FieldError id={`${errorId}-text`} message={questionError?.text?.message} />
      </div>
    </div>
    <fieldset className="rl-adm-fieldset" aria-describedby={groupError ? `${errorId}-answers` : undefined}>
      <legend className="rl-field-label">Antworten</legend>
      <p className="rl-qe-hint">Markiere genau eine richtige Lösung mit dem Auswahlkreis.</p>
      <FieldError id={`${errorId}-answers`} message={groupError} />
      <ul className="rl-qe-answers">
        {fields.map((field, answerIndex) => {
          const correct = answers?.[answerIndex]?.correct ?? false;
          const letter = answerLetter(answerIndex);
          const textError = answerError?.[answerIndex]?.text?.message;
          return <li key={field.id} className={`rl-qe-answer rl-qe-tone-${answerIndex % 4}${correct ? " is-correct" : ""}`}>
            <span className="rl-qe-letter" aria-hidden="true">{letter}</span>
            <input className="rl-qe-answer-input" aria-label={`Antwort ${answerIndex + 1} bei Frage ${number}`} maxLength={200}
              autoComplete="off" placeholder={`Antwort ${letter}`} aria-invalid={Boolean(textError)}
              aria-describedby={textError ? `${errorId}-answer-${answerIndex}` : undefined}
              {...register(`questions.${index}.answers.${answerIndex}.text`)} />
            {correct && <span className="rl-qe-correct-tag" aria-hidden="true">Richtig</span>}
            <label className="rl-qe-mark" title="Als richtige Antwort markieren">
              <input type="radio" className="rl-adm-mark-input" name={`correct-${index}`} checked={correct}
                onChange={() => chooseCorrect(answerIndex)}
                aria-invalid={Boolean(groupError)} aria-describedby={groupError ? `${errorId}-answers` : undefined}
                aria-label={`Antwort ${answerIndex + 1} bei Frage ${number} ist richtig`} />
              <span className="rl-qe-mark-dot" aria-hidden="true"><Check strokeWidth={4} /></span>
            </label>
            <div className="rl-adm-answer-tools">
              <button type="button" className="rl-adm-tool" disabled={answerIndex === 0}
                aria-label={`Antwort ${answerIndex + 1} nach oben`}
                onClick={() => moveAnswer(answerIndex, answerIndex - 1)}><ArrowUp aria-hidden="true" strokeWidth={2.6} /></button>
              <button type="button" className="rl-adm-tool" disabled={answerIndex === fields.length - 1}
                aria-label={`Antwort ${answerIndex + 1} nach unten`}
                onClick={() => moveAnswer(answerIndex, answerIndex + 1)}><ArrowDown aria-hidden="true" strokeWidth={2.6} /></button>
              <button type="button" className="rl-adm-tool is-danger" disabled={fields.length <= 2}
                aria-label={`Antwort ${answerIndex + 1} löschen`} onClick={() => removeAnswer(answerIndex)}>
                <Trash2 aria-hidden="true" strokeWidth={2.4} /></button>
            </div>
            <FieldError id={`${errorId}-answer-${answerIndex}`} message={textError} />
          </li>;
        })}
      </ul>
      <p className={`rl-adm-selection${correctIndex < 0 ? " is-missing" : ""}`} role="status" aria-atomic="true">
        {correctIndex < 0 ? <><CircleHelp aria-hidden="true" /><span>Noch keine richtige Antwort ausgewählt.</span></> :
          <><CheckCircle2 aria-hidden="true" /><span><strong>Richtige Antwort: {answerLetter(correctIndex)}</strong>
            {answers?.[correctIndex]?.text ? ` · ${answers[correctIndex].text}` : " · Antworttext noch ergänzen"}</span></>}
      </p>
      <button type="button" className="rl-add-button" disabled={fields.length >= 8}
        onClick={() => append({ text: "", correct: false })}><Plus strokeWidth={3.4} aria-hidden="true" /> Antwort hinzufügen</button>
    </fieldset>
    <div className="rl-adm-qe-row">
      <div className="rl-qe-explanation">
        <label htmlFor={`question-${index}-duration`}><Timer aria-hidden="true" /> Antwortzeit in Sekunden</label>
        <input id={`question-${index}-duration`} className="rl-input" type="number" min={5} max={120} inputMode="numeric"
          aria-invalid={Boolean(questionError?.durationSeconds)}
          aria-describedby={questionError?.durationSeconds ? `${errorId}-duration` : undefined}
          {...register(`questions.${index}.durationSeconds`, { valueAsNumber: true })} />
        <FieldError id={`${errorId}-duration`} message={questionError?.durationSeconds?.message} />
      </div>
      <div className="rl-qe-explanation">
        <label htmlFor={`question-${index}-explanation`}><Lightbulb aria-hidden="true" /> Erklärung
          <span className="rl-field-optional">optional</span></label>
        <textarea id={`question-${index}-explanation`} className="rl-input rl-textarea" maxLength={1000} rows={2}
          placeholder="Eine kurze Erklärung für die Auflösung" aria-invalid={Boolean(questionError?.explanation)}
          aria-describedby={questionError?.explanation ? `${errorId}-explanation` : undefined}
          {...register(`questions.${index}.explanation`)} />
        <FieldError id={`${errorId}-explanation`} message={questionError?.explanation?.message} />
      </div>
    </div>
  </section>;
}

/**
 * Quiz form in two steps (basics, questions). Both steps stay mounted so that validation and focus work across steps.
 * Local mode: warns before leaving with unsaved changes and offers the explicit draft storage opt-in.
 */
export function QuizForm({ initialQuiz, onSave, saving = false, cloudMode = false, draftStorageEnabled = false,
  onDraftStorageEnabledChange, initialStep = 1, error = "" }: {
  initialQuiz?: Quiz;
  onSave: (quiz: Quiz) => void;
  saving?: boolean;
  cloudMode?: boolean;
  draftStorageEnabled?: boolean;
  onDraftStorageEnabledChange?: (enabled: boolean) => void;
  initialStep?: EditorStep;
  error?: string;
}) {
  const form = useForm<Quiz>({
    resolver: zodResolver(quizSchema),
    defaultValues: initialQuiz
      ? { ...initialQuiz, category: initialQuiz.category ?? DEFAULT_CATEGORY }
      : { title: "", description: "", category: DEFAULT_CATEGORY, questions: [newQuestion()] },
  });
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: "questions" });
  const questions = useWatch({ control: form.control, name: "questions" });
  const [title, description, category] = useWatch({ control: form.control, name: ["title", "description", "category"] });
  const errors = form.formState.errors;
  const isDirty = form.formState.isDirty;
  const navigate = useNavigate();
  const [destination, setDestination] = useState<string | null>(null);
  const [step, setStep] = useState<EditorStep>(initialStep);
  const basicsRef = useRef<HTMLDivElement>(null);
  const questionsRef = useRef<HTMLDivElement>(null);
  const chosenCount = questions.filter((question) => question.answers.some((answer) => answer.correct)).length;
  const basicsDone = basicsComplete({ title, description, category });
  const questionsDone = questions.length > 0 && questions.every(questionComplete);

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
      const target = new URL(link.href, window.location.href);
      if (target.origin !== window.location.origin ||
          (target.pathname === window.location.pathname && target.search === window.location.search)) return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(target.pathname + target.search + target.hash);
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", confirmNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", confirmNavigation, true);
    };
  }, [cloudMode, isDirty]);

  function goToStep(next: EditorStep) {
    flushSync(() => setStep(next));
    (next === 1 ? basicsRef : questionsRef).current?.focus();
  }
  async function continueToQuestions() {
    if (await form.trigger([...BASICS_FIELDS], { shouldFocus: true })) goToStep(2);
  }
  function showInvalidStep(invalid: FieldErrors<Quiz>) {
    // Synchronous render so that react-hook-form can focus the first invalid field in the now visible step.
    flushSync(() => setStep(BASICS_FIELDS.some((name) => invalid[name]) ? 1 : 2));
  }
  function focusQuestion(index: number) {
    document.getElementById(`question-${index + 1}`)?.focus();
  }

  return <FormProvider {...form}>
    <ConfirmDialog title="Änderungen verwerfen?" variant="warning"
      description="Deine Änderungen sind noch nicht gespeichert. Wenn du die Seite verlässt, gehen sie verloren."
      confirmLabel="Änderungen verwerfen" open={destination !== null}
      onOpenChange={(open) => { if (!open) setDestination(null); }}
      onConfirm={() => { if (destination !== null) void navigate(destination); }} />
    <form noValidate className="rl-adm-editor-form" aria-label="Quiz bearbeiten" onSubmit={(event) => {
      if (step === 1) { event.preventDefault(); void continueToQuestions(); return; }
      void form.handleSubmit(onSave, showInvalidStep)(event);
    }}>
      <Stepper current={step} done={{ 1: basicsDone, 2: questionsDone, 3: basicsDone && questionsDone }} onSelect={goToStep} />

      <div ref={basicsRef} className="rl-adm-step-panel rl-basics" hidden={step !== 1} tabIndex={-1}
        role="group" aria-labelledby="quiz-basics-heading">
        <h2 id="quiz-basics-heading" className="rl-section-title">Gib deiner Runde einen Namen.</h2>
        <div className="rl-form-card">
          <div className="rl-field">
            <label className="rl-field-label" htmlFor="quiz-title"><Pencil aria-hidden="true" /> Quiztitel</label>
            <input id="quiz-title" className="rl-input" maxLength={120} autoComplete="off"
              placeholder="Zum Beispiel: Die große Feierabendrunde" aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "quiz-title-error" : undefined} {...form.register("title")} />
            <FieldError id="quiz-title-error" message={errors.title?.message} />
          </div>
          <div className="rl-field">
            <label className="rl-field-label" htmlFor="quiz-category"><Layers aria-hidden="true" /> Kategorie</label>
            <div className="rl-select">
              <CategoryIcon category={category} className="rl-select-icon" />
              <select id="quiz-category" className="rl-input" aria-invalid={Boolean(errors.category)}
                aria-describedby={errors.category ? "quiz-category-error" : undefined} {...form.register("category")}>
                {QUIZ_CATEGORIES.map((id) => <option key={id} value={id}>{CATEGORY_LABELS[id]}</option>)}
              </select>
              <ChevronDown className="rl-select-chevron" aria-hidden="true" strokeWidth={3} />
            </div>
            <FieldError id="quiz-category-error" message={errors.category?.message} />
          </div>
          <div className="rl-field">
            <label className="rl-field-label" htmlFor="quiz-description">
              <FileText aria-hidden="true" /> Beschreibung <span className="rl-field-optional">optional</span>
            </label>
            <textarea id="quiz-description" className="rl-input rl-textarea" rows={3} maxLength={500} placeholder="Worum geht es?"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? "quiz-description-error" : undefined} {...form.register("description")} />
            <FieldError id="quiz-description-error" message={errors.description?.message} />
          </div>
        </div>
      </div>

      <div ref={questionsRef} className="rl-adm-step-panel" hidden={step !== 2} tabIndex={-1}
        role="group" aria-labelledby="quiz-questions-heading">
        <h2 id="quiz-questions-heading" className="rl-section-title">
          {fields.length} {fields.length === 1 ? "Frage" : "Fragen"} · {chosenCount} von {fields.length} Lösungen gewählt
        </h2>
        <nav className="rl-qe-pager" aria-label="Fragen im Quiz">
          <ol>
            {questions.map((question, index) => {
              const complete = questionComplete(question);
              return <li key={fields[index]?.id ?? index}>
                <button type="button" className={`rl-qe-chip${complete ? " is-complete" : ""}`}
                  aria-label={`Zu Frage ${index + 1} springen${complete ? ", fertig" : ", noch offen"}`}
                  onClick={() => focusQuestion(index)}>{index + 1}</button>
              </li>;
            })}
          </ol>
        </nav>
        {fields.map((field, index) => <QuestionFields key={`${field.id}-${index}`} index={index} total={fields.length}
          move={move} remove={remove} />)}
        <FieldError id="quiz-questions-error" message={errors.questions?.root?.message ?? errors.questions?.message} />
        <div className="rl-qe-actions">
          <button type="button" className="rl-add-button" disabled={fields.length >= 100}
            onClick={() => append(newQuestion())}><Plus strokeWidth={3.4} aria-hidden="true" /> Frage hinzufügen</button>
        </div>
        {!cloudMode && <div className="rl-card rl-adm-storage rl-adm-editor-storage">
          <label className="rl-checkbox">
            <input type="checkbox" checked={draftStorageEnabled}
              onChange={(event) => onDraftStorageEnabledChange?.(event.target.checked)} />
            Quiz-Entwürfe auf diesem Gerät speichern
          </label>
          <p>Erst nach dem Einschalten werden Entwürfe beim Klick auf „Entwurf speichern“ dauerhaft in diesem Browser abgelegt.
            Bereits vorhandene Entwürfe bleiben erhalten; Ausschalten löscht sie nicht. Die Auswahl betrifft nur diese Speicherfunktion.</p>
        </div>}
      </div>

      {error && <div className="rl-adm-editor-notices"><ErrorNotice error={error} /></div>}

      <footer className="rl-editor-footer">
        <Meadow className="rl-editor-meadow" />
        <LlamaCharacter key={step} mood={step === 1 ? "proud" : "cheering"} className="rl-editor-llama" />
        <div className="rl-editor-action">
          {step === 1
            ? <button key="next" type="submit" className="rl-start-button rl-editor-button">
              Weiter <ArrowRight strokeWidth={3} aria-hidden="true" /></button>
            : <button key="save" type="submit" className="rl-start-button rl-editor-button" disabled={saving}>
              <Save strokeWidth={2.6} aria-hidden="true" />
              {saving ? "Wird gespeichert …" : cloudMode ? "Quiz speichern" : "Entwurf speichern"}</button>}
          {step === 2 && <p className="rl-adm-save-note">{cloudMode ? "Änderungen werden erst beim Speichern übernommen." :
            draftStorageEnabled ? "Dein Entwurf wird nach dem Speichern nur in diesem Browser abgelegt." :
              "Ohne Aktivierung bleibt dein Quiz nur im Arbeitsspeicher und geht beim Verlassen verloren."}</p>}
        </div>
      </footer>
    </form>
  </FormProvider>;
}
