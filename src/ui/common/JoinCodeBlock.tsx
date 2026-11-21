import { formatJoinCode } from "../../shareLinks";
import { CopyAction } from "./CopyAction";

export function JoinCodeBlock({ joinCode, title, label = "Quiz-Code" }: { joinCode: string; title: string; label?: string }) {
  return <div className="rl-join-code">
    <span className="rl-eyebrow">{label}</span>
    <strong className="rl-join-code-digits" aria-label={`${label} ${joinCode.split("").join(" ")}`}>{formatJoinCode(joinCode)}</strong>
    <CopyAction text={joinCode} label="Code kopieren" copiedMessage="Code kopiert." fieldLabel={`${label} für ${title}`} />
  </div>;
}
