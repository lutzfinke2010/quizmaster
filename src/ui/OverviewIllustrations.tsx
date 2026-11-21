import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

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
