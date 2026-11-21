import { CircleAlert } from "lucide-react";
import "../quizzes.css";

/** Inline validation message, referenced by the field via aria-describedby. */
export function FieldError({ message, id }: { message?: string; id: string }) {
  return message ? <p id={id} className="rl-field-error" role="alert"><CircleAlert aria-hidden="true" /> {message}</p> : null;
}
