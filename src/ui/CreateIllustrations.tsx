import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function TeamTrio(props: IconProps) {
  const face = (cx: number, cy: number, scale = 1) => <g fill="none" stroke="#3a2a1e" strokeWidth={1.8 * scale} strokeLinecap="round">
    <path d={`M${cx - 4 * scale} ${cy - 1}v1.5M${cx + 4 * scale} ${cy - 1}v1.5`} />
    <path d={`M${cx - 3.5 * scale} ${cy + 3 * scale}q${3.5 * scale} ${3 * scale} ${7 * scale} 0`} />
  </g>;
  return <svg viewBox="0 0 80 64" aria-hidden="true" {...props}>
    <ellipse cx="40" cy="60" rx="34" ry="3.5" fill="#5a3e1a" opacity=".12" />
    <path d="M3 57c0-12 6-20 15-20s15 8 15 20z" fill="#3d86d6" />
    <circle cx="18" cy="25" r="9.5" fill="#5aa6f0" />
    {face(18, 25)}
    <path d="M47 57c0-12 6-20 15-20s15 8 15 20z" fill="#8656d6" />
    <circle cx="62" cy="25" r="9.5" fill="#a77cf0" />
    {face(62, 25)}
    <path d="M22 59c0-14 8-24 18-24s18 10 18 24z" fill="#ff8a2a" stroke="#fffdf8" strokeWidth="2.5" />
    <circle cx="40" cy="21" r="12" fill="#ffc21a" stroke="#fffdf8" strokeWidth="2.5" />
    {face(40, 21, 1.2)}
  </svg>;
}

export function Paw(props: IconProps) {
  return <svg viewBox="0 0 80 72" aria-hidden="true" {...props}>
    <ellipse cx="40" cy="38" rx="33" ry="30" fill="#c9eeaa" />
    <path d="M6 60c6-11 17-13 24-6-8 7-17 8-24 6z" fill="#5cbd44" />
    <path d="M74 60c-6-11-17-13-24-6 8 7 17 8 24 6z" fill="#4aa83a" />
    <g fill="#b0683a">
      <path d="M40 36c8 0 16 8 16 15 0 6-5 8-9 7-3-1-5-2-7-2s-4 1-7 2c-4 1-9-1-9-7 0-7 8-15 16-15z" />
      <ellipse cx="23" cy="34" rx="5.5" ry="7.5" transform="rotate(-24 23 34)" />
      <ellipse cx="33" cy="23" rx="5.5" ry="7.5" transform="rotate(-8 33 23)" />
      <ellipse cx="47" cy="23" rx="5.5" ry="7.5" transform="rotate(8 47 23)" />
      <ellipse cx="57" cy="34" rx="5.5" ry="7.5" transform="rotate(24 57 34)" />
    </g>
    <g fill="#d48c5a"><ellipse cx="36" cy="44" rx="4" ry="2.5" /><ellipse cx="31" cy="21" rx="1.8" ry="2.6" /></g>
  </svg>;
}

export function QuestionBubble(props: IconProps) {
  return <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
    <defs>
      <linearGradient id="rl-bubble" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4fd6cf" /><stop offset="1" stopColor="#1fa6b8" />
      </linearGradient>
    </defs>
    <path d="M24 3c11.6 0 21 8.3 21 18.6S35.6 40 24 40c-2.2 0-4.3-.3-6.3-.8L7 45l2.6-9.6C5.5 32.1 3 27.1 3 21.6 3 11.3 12.4 3 24 3z"
      fill="url(#rl-bubble)" stroke="#16879a" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M12 14c2-3 5-5 9-6" stroke="#ffffff80" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    <text x="24" y="31" textAnchor="middle" fontSize="24" fontWeight="900" fill="#fff" fontFamily="ui-rounded, system-ui, sans-serif">?</text>
  </svg>;
}

function Daisy({ cx, cy, r = 4 }: { cx: number; cy: number; r?: number }) {
  return <g>
    <circle cx={cx} cy={cy} r={r} fill="#fff" /><circle cx={cx} cy={cy} r={r * .42} fill="#ffcc2e" />
  </g>;
}

/** Small mountain range framing a centred heading. */
export function MountainStrip(props: IconProps) {
  return <svg viewBox="0 0 360 100" preserveAspectRatio="xMidYMax slice" aria-hidden="true" {...props}>
    <g fill="#fff" opacity=".95">
      <ellipse cx="34" cy="26" rx="22" ry="9" /><ellipse cx="48" cy="20" rx="13" ry="9" />
      <ellipse cx="320" cy="22" rx="20" ry="8" /><ellipse cx="334" cy="16" rx="12" ry="8" />
    </g>
    <path d="M-8 100L30 50l22 26 14-12 30 36z" fill="#9fb3d3" />
    <path d="M30 50l-9 12 5-2 4 4 4-4 5 2z" fill="#fff" />
    <path d="M262 100l46-56 24 30 14-10 26 36z" fill="#8ea4c8" />
    <path d="M308 44l-10 13 5-2 5 5 5-5 5 2z" fill="#fff" />
    <g fill="#bfe38f">
      <ellipse cx="30" cy="100" rx="58" ry="14" /><ellipse cx="330" cy="100" rx="58" ry="14" />
    </g>
    <g fill="#9fd468"><ellipse cx="74" cy="96" rx="16" ry="10" /><ellipse cx="290" cy="96" rx="16" ry="10" /></g>
    <Daisy cx={16} cy={92} /><Daisy cx={344} cy={90} />
  </svg>;
}

/** Bushes and daisies for the bottom of a screen. */
export function Meadow(props: IconProps) {
  return <svg viewBox="0 0 360 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true" {...props}>
    <g fill="#fff" opacity=".9"><ellipse cx="292" cy="26" rx="20" ry="8" /><ellipse cx="306" cy="20" rx="12" ry="8" /></g>
    <path d="M0 140V96c40-14 90-18 140-10s110 2 150-12 50-6 70-2v68z" fill="#d6eeb2" />
    <g fill="#a9dc76">
      <ellipse cx="240" cy="88" rx="26" ry="20" /><ellipse cx="270" cy="74" rx="24" ry="24" />
      <ellipse cx="304" cy="80" rx="26" ry="22" /><ellipse cx="338" cy="68" rx="24" ry="24" />
      <ellipse cx="12" cy="92" rx="26" ry="18" />
    </g>
    <g fill="#8fcf5a"><ellipse cx="284" cy="92" rx="20" ry="14" /><ellipse cx="350" cy="90" rx="18" ry="14" /></g>
    <path d="M0 140v-30c60-10 120-12 180-6s120 6 180-4v40z" fill="#eaf6d4" />
    <Daisy cx={262} cy={58} r={5} /><Daisy cx={322} cy={50} r={5} /><Daisy cx={346} cy={100} r={4.5} />
    <Daisy cx={300} cy={104} r={4} /><Daisy cx={24} cy={84} r={4.5} />
  </svg>;
}
