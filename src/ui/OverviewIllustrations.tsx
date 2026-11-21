import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const OUTLINE = "#4a3426";

export function BookStack(props: IconProps) {
  return <svg viewBox="0 0 96 80" aria-hidden="true" {...props}>
    <ellipse cx="48" cy="74" rx="38" ry="4" fill="#5a3e1a" opacity=".12" />
    <rect x="10" y="50" width="76" height="20" rx="4" fill="#e24a3b" />
    <rect x="16" y="54" width="66" height="12" rx="2" fill="#fff7e8" />
    <path d="M16 58h66M16 62h66" stroke="#e5d9c2" strokeWidth="1.2" />
    <rect x="10" y="50" width="10" height="20" rx="3" fill="#c13628" />
    <g transform="rotate(-4 48 40)">
      <rect x="14" y="31" width="70" height="19" rx="4" fill="#3d8fe0" />
      <rect x="20" y="35" width="60" height="11" rx="2" fill="#fff7e8" />
      <path d="M20 40.5h60" stroke="#e5d9c2" strokeWidth="1.2" />
      <rect x="74" y="31" width="10" height="19" rx="3" fill="#2b6fb8" />
    </g>
    <g transform="rotate(5 48 22)">
      <rect x="18" y="12" width="62" height="18" rx="4" fill="#3fae4a" />
      <rect x="24" y="16" width="52" height="10" rx="2" fill="#fff7e8" />
      <rect x="18" y="12" width="9" height="18" rx="3" fill="#2d8a37" />
      <rect x="44" y="12" width="8" height="18" fill="#ffcf24" />
    </g>
  </svg>;
}

export function Globe(props: IconProps) {
  return <svg viewBox="0 0 80 88" aria-hidden="true" {...props}>
    <defs>
      <radialGradient id="rl-ocean" cx=".35" cy=".3" r=".8">
        <stop offset="0" stopColor="#7fd0ff" /><stop offset=".6" stopColor="#2f8fe0" /><stop offset="1" stopColor="#1c63b4" />
      </radialGradient>
    </defs>
    <path d="M14 44a28 28 0 0 0 48 18" fill="none" stroke="#d9a21b" strokeWidth="5" strokeLinecap="round" />
    <rect x="36" y="70" width="8" height="8" fill="#b9821a" />
    <ellipse cx="40" cy="80" rx="18" ry="5" fill="#d9a21b" />
    <circle cx="40" cy="40" r="26" fill="url(#rl-ocean)" />
    <path d="M24 26c6-4 12-3 14 2s-3 8-1 12-3 7-8 5-8-6-9-10 0-6 4-9z" fill="#5cc24a" />
    <path d="M44 20c6 0 12 4 14 10-3 2-7 1-9 4s1 8-3 10-6-4-6-8 0-8-3-10 3-6 7-6z" fill="#5cc24a" />
    <path d="M46 52c4-2 9 0 10 3s-3 7-7 7-6-2-6-5 1-4 3-5z" fill="#5cc24a" />
    <ellipse cx="31" cy="27" rx="6" ry="3.5" transform="rotate(-30 31 27)" fill="#fff" opacity=".45" />
  </svg>;
}

export function Flask(props: IconProps) {
  return <svg viewBox="0 0 80 88" aria-hidden="true" {...props}>
    <defs>
      <linearGradient id="rl-potion" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c879f2" /><stop offset="1" stopColor="#8a3fd1" />
      </linearGradient>
    </defs>
    <ellipse cx="40" cy="82" rx="26" ry="4" fill="#5a3e1a" opacity=".12" />
    <path d="M31 10h18v20l20 38c2 6-1 12-8 12H19c-7 0-10-6-8-12l20-38z" fill="#eef7fb" stroke="#b7cfdc" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M22 48h36l9 20c2 5-1 9-6 9H19c-5 0-8-4-6-9z" fill="url(#rl-potion)" />
    <rect x="28" y="5" width="24" height="8" rx="4" fill="#d9e8ef" stroke="#b7cfdc" strokeWidth="2" />
    <circle cx="34" cy="60" r="3.4" fill="#f2c6ff" /><circle cx="46" cy="66" r="2.4" fill="#f2c6ff" />
    <circle cx="42" cy="40" r="2.6" fill="#d9a8f7" /><circle cx="38" cy="30" r="1.8" fill="#d9a8f7" />
    <path d="M34 16v14l-6 12" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".9" />
  </svg>;
}

export function LlamaMascot(props: IconProps) {
  const fluff: Array<[number, number, number]> = [
    [72, 50, 15], [88, 38, 16], [107, 34, 16], [124, 40, 15], [136, 54, 13], [64, 68, 12], [140, 70, 10],
  ];
  const chest: Array<[number, number, number]> = [[78, 196, 16], [100, 204, 18], [124, 196, 16]];
  const silhouette = <>
    <ellipse cx="70" cy="26" rx="11" ry="27" transform="rotate(-14 70 26)" />
    <ellipse cx="134" cy="26" rx="11" ry="27" transform="rotate(14 134 26)" />
    <rect x="70" y="100" width="62" height="100" rx="28" />
    <ellipse cx="102" cy="220" rx="58" ry="40" />
    {chest.map(([cx, cy, r]) => <circle key={`c${cx}`} cx={cx} cy={cy} r={r} />)}
    <ellipse cx="102" cy="80" rx="42" ry="38" />
    {fluff.map(([cx, cy, r]) => <circle key={`f${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
    <ellipse cx="54" cy="186" rx="15" ry="32" transform="rotate(28 54 186)" />
  </>;
  return <svg viewBox="0 0 200 260" aria-hidden="true" {...props}>
    <rect x="132" y="150" width="58" height="92" rx="18" fill="#2f9e5a" stroke={OUTLINE} strokeWidth="3.5" />
    <rect x="142" y="196" width="40" height="30" rx="8" fill="#26864b" />
    <g fill={OUTLINE} stroke={OUTLINE} strokeWidth="7" strokeLinejoin="round">{silhouette}</g>
    <g fill="#fdf3df">{silhouette}</g>
    <ellipse cx="70" cy="28" rx="5" ry="18" transform="rotate(-14 70 28)" fill="#f6b7ad" />
    <ellipse cx="134" cy="28" rx="5" ry="18" transform="rotate(14 134 28)" fill="#f6b7ad" />
    <g fill="#f6e4c3"><circle cx="90" cy="40" r="7" /><circle cx="110" cy="36" r="7" /><circle cx="126" cy="44" r="5" /></g>
    <path d="M140 150c-14 30-12 60-2 92" fill="none" stroke="#7a4a1d" strokeWidth="9" strokeLinecap="round" />
    <path d="M64 140c24 14 52 14 76 0l-10 42c-8 14-48 14-56 0z" fill="#1f9a77" stroke={OUTLINE} strokeWidth="3.5" strokeLinejoin="round" />
    <path d="M96 156l8-1 2 6 4-1v10h-3v-5h-6v5h-3z" fill="#e7fbf2" />
    <ellipse cx="104" cy="98" rx="24" ry="17" fill="#fffaf0" />
    <path d="M78 82q8-8 16 0" fill="none" stroke={OUTLINE} strokeWidth="4" strokeLinecap="round" />
    <ellipse cx="122" cy="80" rx="6" ry="7.5" fill={OUTLINE} />
    <circle cx="124" cy="77" r="2.2" fill="#fff" />
    <path d="M100 91h9l-4.5 4z" fill={OUTLINE} stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round" />
    <path d="M92 100q12 18 25 0z" fill="#c9443b" stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
    <path d="M97 107q7-4 14 0q-7 6-14 0z" fill="#f2847a" />
    <ellipse cx="74" cy="98" rx="7" ry="4.5" fill="#f59b92" opacity=".55" />
    <ellipse cx="136" cy="96" rx="7" ry="4.5" fill="#f59b92" opacity=".55" />
    <rect x="31" y="124" width="14" height="26" rx="7" fill="#6b4a35" stroke={OUTLINE} strokeWidth="3" />
    <circle cx="44" cy="156" r="16" fill="#6b4a35" stroke={OUTLINE} strokeWidth="3" />
    <path d="M36 150h14M36 158h14" stroke="#523726" strokeWidth="2.4" strokeLinecap="round" />
  </svg>;
}
