import type { CSSProperties } from "react";

const colors = ["#d8ef91", "#f4b89a", "#b6a0dd", "#73b9af"];

export function AnswerCelebration({ final = false }: { final?: boolean }) {
  return <div className={`answer-confetti${final ? " final-confetti" : ""}`} aria-hidden="true">
    {Array.from({ length: final ? 48 : 18 }, (_, index) => {
      const style: CSSProperties & { "--drift": string; "--spin": string } = {
        left: `${8 + (index * 19) % 84}%`,
        backgroundColor: colors[index % colors.length],
        animationDelay: `${(index % 5) * 80}ms`,
        "--drift": `${(index % 2 ? 1 : -1) * (15 + index % 4 * 10)}px`,
        "--spin": `${(index % 2 ? 1 : -1) * 240}deg`,
      };
      return <span key={index} style={style} />;
    })}
  </div>;
}
