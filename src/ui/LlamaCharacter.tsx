import type { SVGProps } from "react";
import "./llama.css";

export type LlamaMood = "curious" | "cheering" | "surprised" | "proud";

const OUTLINE = "#4a3426";
const WOOL = "#fdf3df";
const HOOF = "#6b4a35";

const FLUFF: Array<[number, number, number]> = [
  [80, 56, 15], [96, 44, 16], [114, 40, 16], [131, 46, 15], [144, 60, 13], [72, 74, 12], [149, 76, 10],
];

function Arms({ mood }: { mood: LlamaMood }) {
  if (mood === "cheering") return <>
    <ellipse cx="54" cy="150" rx="14" ry="38" transform="rotate(-32 54 150)" />
    <ellipse cx="166" cy="150" rx="14" ry="38" transform="rotate(32 166 150)" />
  </>;
  if (mood === "curious") return <ellipse cx="158" cy="160" rx="14" ry="36" transform="rotate(18 158 160)" />;
  if (mood === "proud") return <ellipse cx="164" cy="156" rx="14" ry="40" transform="rotate(20 164 156)" />;
  return null;
}

function Hooves({ mood }: { mood: LlamaMood }) {
  const hoof = (cx: number, cy: number) => <g key={`${cx}-${cy}`}>
    <circle cx={cx} cy={cy} r="14" fill={HOOF} stroke={OUTLINE} strokeWidth="3.5" />
    <path d={`M${cx - 7} ${cy - 3}h14M${cx - 7} ${cy + 4}h14`} stroke="#523726" strokeWidth="2.2" strokeLinecap="round" />
  </g>;
  if (mood === "cheering") return <g className="rl-llama-hooves">{hoof(38, 116)}{hoof(182, 116)}</g>;
  if (mood === "curious") return <g className="rl-llama-hooves">{hoof(146, 128)}</g>;
  if (mood === "proud") return <g className="rl-llama-hooves">
    <rect x="168" y="88" width="13" height="30" rx="6.5" fill={HOOF} stroke={OUTLINE} strokeWidth="3.5" />
    <circle cx="180" cy="120" r="15" fill={HOOF} stroke={OUTLINE} strokeWidth="3.5" />
    <path d="M173 116h14M173 123h14" stroke="#523726" strokeWidth="2.2" strokeLinecap="round" />
  </g>;
  return null;
}

function Face({ mood }: { mood: LlamaMood }) {
  if (mood === "proud") return <>
    <path d="M86 88q8-8 16 0M122 88q8-8 16 0" fill="none" stroke={OUTLINE} strokeWidth="4" strokeLinecap="round" />
    <path d="M102 105q12 13 24 0" fill="none" stroke={OUTLINE} strokeWidth="3.5" strokeLinecap="round" />
  </>;
  if (mood === "cheering") return <>
    <path d="M88 88q8-9 16 0M122 88q8-9 16 0" fill="none" stroke={OUTLINE} strokeWidth="4" strokeLinecap="round" />
    <path d="M100 104q14 24 28 0z" fill="#c9443b" stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
    <path d="M106 114q8-5 16 0q-8 6-16 0z" fill="#f2847a" />
  </>;
  if (mood === "surprised") return <>
    <path d="M86 70q8-6 16-2M124 68q8-4 16 2" fill="none" stroke={OUTLINE} strokeWidth="3" strokeLinecap="round" />
    <circle cx="95" cy="86" r="9.5" fill="#fff" stroke={OUTLINE} strokeWidth="2.6" />
    <circle cx="131" cy="86" r="9.5" fill="#fff" stroke={OUTLINE} strokeWidth="2.6" />
    <circle cx="96" cy="87" r="5" fill={OUTLINE} /><circle cx="132" cy="87" r="5" fill={OUTLINE} />
    <circle cx="98" cy="85" r="1.6" fill="#fff" /><circle cx="134" cy="85" r="1.6" fill="#fff" />
    <ellipse cx="114" cy="112" rx="5" ry="7" fill="#a8362f" stroke={OUTLINE} strokeWidth="2.4" />
  </>;
  return <>
    <path d="M86 88q8-8 16 0" fill="none" stroke={OUTLINE} strokeWidth="4" strokeLinecap="round" />
    <path d="M122 76q8-5 15 1" fill="none" stroke={OUTLINE} strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="130" cy="86" rx="5.5" ry="6.5" fill={OUTLINE} /><circle cx="132" cy="83.5" r="1.8" fill="#fff" />
    <path d="M106 110q7 3 14-2" fill="none" stroke={OUTLINE} strokeWidth="3" strokeLinecap="round" />
  </>;
}

function Extras({ mood }: { mood: LlamaMood }) {
  if (mood === "curious") return <g className="rl-llama-thought">
    <circle cx="160" cy="114" r="4" fill="#3cc4c0" /><circle cx="170" cy="100" r="6" fill="#3cc4c0" />
    <circle cx="190" cy="74" r="20" fill="#3cc4c0" stroke="#249f9b" strokeWidth="2" />
    <text x="190" y="84" textAnchor="middle" fontSize="28" fontWeight="900" fill="#fff" fontFamily="ui-rounded, system-ui, sans-serif">?</text>
  </g>;
  if (mood === "surprised") return <g className="rl-llama-alert" fill="#e8343f">
    <path d="M160 14l9 2-6 26-6-1z" /><circle cx="158" cy="48" r="3.6" />
    <path d="M176 20l8 4-11 23-5-3z" /><circle cx="168" cy="52" r="3.4" />
  </g>;
  if (mood === "proud") return <g className="rl-llama-sparks" stroke="#ffc21a" strokeWidth="5" strokeLinecap="round">
    <path d="M196 86l10-8" /><path d="M202 108h12" /><path d="M184 72l2-12" />
  </g>;
  return <g className="rl-llama-sparks" stroke="#ffc21a" strokeWidth="5" strokeLinecap="round">
    <path d="M20 70l12 6" /><path d="M16 96h13" /><path d="M200 70l-12 6" /><path d="M204 96h-13" />
    <path d="M150 32l6-11" /><path d="M70 32l-6-11" />
  </g>;
}

export function LlamaCharacter({ mood, ...props }: SVGProps<SVGSVGElement> & { mood: LlamaMood }) {
  const silhouette = <>
    <ellipse cx="80" cy="30" rx="11" ry="27" transform="rotate(-14 80 30)" />
    <ellipse cx="144" cy="30" rx="11" ry="27" transform="rotate(14 144 30)" />
    <rect x="82" y="110" width="62" height="120" rx="30" />
    <ellipse cx="112" cy="236" rx="74" ry="50" />
    <ellipse cx="112" cy="88" rx="42" ry="38" />
    {FLUFF.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
    <Arms mood={mood} />
  </>;
  return <svg viewBox="0 0 224 240" aria-hidden="true" {...props} className={`rl-llama rl-llama-${mood} ${props.className ?? ""}`}>
    <rect x="30" y="170" width="52" height="80" rx="18" fill="#2f9e5a" stroke={OUTLINE} strokeWidth="3.5" />
    <g className="rl-llama-body">
      <g fill={OUTLINE} stroke={OUTLINE} strokeWidth="7" strokeLinejoin="round">{silhouette}</g>
      <g fill={WOOL}>{silhouette}</g>
      <ellipse cx="80" cy="32" rx="5" ry="18" transform="rotate(-14 80 32)" fill="#f6b7ad" />
      <ellipse cx="144" cy="32" rx="5" ry="18" transform="rotate(14 144 32)" fill="#f6b7ad" />
      <g fill="#f6e4c3"><circle cx="98" cy="46" r="7" /><circle cx="118" cy="42" r="7" /><circle cx="134" cy="50" r="5" /></g>
      <path d="M74 170c-6 24-6 48 0 70" fill="none" stroke="#7a4a1d" strokeWidth="9" strokeLinecap="round" />
      <path d="M74 158c26 16 50 16 76 0l-10 40c-8 14-48 14-56 0z" fill="#1f9a77" stroke={OUTLINE} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M106 176l8-1 2 6 4-1v10h-3v-5h-6v5h-3z" fill="#e7fbf2" />
      <ellipse cx="114" cy="104" rx="24" ry="17" fill="#fffaf0" />
      <path d="M109 96h9l-4.5 4z" fill={OUTLINE} stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="82" cy="102" rx="7" ry="4.5" fill="#f59b92" opacity=".55" />
      <ellipse cx="146" cy="100" rx="7" ry="4.5" fill="#f59b92" opacity=".55" />
      <Face mood={mood} />
      <Hooves mood={mood} />
    </g>
    <Extras mood={mood} />
  </svg>;
}
