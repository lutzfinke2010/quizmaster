import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { FormProvider, useFieldArray, useForm, useFormContext, useWatch } from "react-hook-form";
import { newQuestion, quizSchema, type Quiz } from "./domain/quiz";
import { Button } from "./components/ui/button";

function FieldError({ message }: { message?: string }) {
  return message ? <span className="field-error" role="alert">{message}</span> : null;
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

  function chooseCorrect(selected: number) {
    fields.forEach((_, answerIndex) =>
      setValue(`questions.${index}.answers.${answerIndex}.correct`, answerIndex === selected, { shouldDirty: true }),
    );
    void trigger(`questions.${index}.answers`);
  }

  return <section className="question-card">
    <div className="question-heading">
      <h2><span className="question-number">{index + 1}</span> Frage {index + 1}</h2>
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
      <input maxLength={500} placeholder="Was möchtest du wissen?" {...register(`questions.${index}.text`)} />
      <FieldError message={questionError?.text?.message} />
    </label>
    <fieldset className="answers">
      <legend>Antworten <span className="hint">· Eine richtige Antwort auswählen</span></legend>
      <FieldError message={answerError?.root?.message ?? answerError?.message} />
      {fields.map((field, answerIndex) => <div className="answer-row" key={field.id}>
        <label className="correct-choice" title="Als richtige Antwort markieren">
          <input type="radio" name={`correct-${index}`} checked={answers?.[answerIndex]?.correct ?? false}
            onChange={() => chooseCorrect(answerIndex)}
            aria-label={`Antwort ${answerIndex + 1} bei Frage ${index + 1} ist richtig`} />
          <span>{String.fromCharCode(65 + answerIndex)}</span>
        </label>
        <div className="answer-input">
          <input aria-label={`Antwort ${answerIndex + 1} bei Frage ${index + 1}`} maxLength={200}
            placeholder={`Antwort ${String.fromCharCode(65 + answerIndex)}`}
            {...register(`questions.${index}.answers.${answerIndex}.text`)} />
          <FieldError message={answerError?.[answerIndex]?.text?.message} />
        </div>
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
      </div>)}
      <button type="button" className="text-button" disabled={fields.length >= 8}
        onClick={() => append({ text: "", correct: false })}><Plus size={16} /> Antwort hinzufügen</button>
    </fieldset>
    <div className="question-details">
      <label className="field">Antwortzeit in Sekunden
        <input type="number" min={5} max={120} {...register(`questions.${index}.durationSeconds`, { valueAsNumber: true })} />
        <FieldError message={questionError?.durationSeconds?.message} />
      </label>
      <label className="field">Erklärung <span className="hint">(optional)</span>
        <textarea maxLength={1000} rows={2} placeholder="Eine kurze Erklärung für die Auflösung"
          {...register(`questions.${index}.explanation`)} />
        <FieldError message={questionError?.explanation?.message} />
      </label>
    </div>
  </section>;
}

export function QuizEditor({ initialQuiz, onSave, saving = false, cloudMode = false }: {
  initialQuiz?: Quiz;
  onSave: (quiz: Quiz) => void;
  saving?: boolean;
  cloudMode?: boolean;
}) {
  const form = useForm<Quiz>({
    resolver: zodResolver(quizSchema),
    defaultValues: initialQuiz ?? { title: "", description: "", questions: [newQuestion()] },
  });
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: "questions" });
  return <FormProvider {...form}>
    <form onSubmit={form.handleSubmit(onSave, () => form.setFocus("title"))} noValidate>
      <section className="question-card">
        <div className="metadata">
          <label className="field">Quiztitel
            <input maxLength={120} placeholder="Dein Quizname" {...form.register("title")} />
            <FieldError message={form.formState.errors.title?.message} />
          </label>
          <label className="field">Beschreibung <span className="hint">(optional)</span>
            <input maxLength={500} placeholder="Worum geht es?" {...form.register("description")} />
            <FieldError message={form.formState.errors.description?.message} />
          </label>
        </div>
      </section>
      {fields.map((field, index) => <QuestionFields key={`${field.id}-${index}`} index={index} total={fields.length}
        move={move} remove={remove} />)}
      <FieldError message={form.formState.errors.questions?.root?.message ?? form.formState.errors.questions?.message} />
      <div className="editor-actions">
        <button type="button" className="button secondary" disabled={fields.length >= 100}
          onClick={() => append(newQuestion())}><Plus size={18} /> Frage hinzufügen</button>
        <Button type="submit" className="button primary" disabled={saving}><Save size={18} />
          {saving ? "Wird gespeichert …" : cloudMode ? "Quiz speichern" : "Entwurf speichern"}</Button>
      </div>
    </form>
  </FormProvider>;
}
