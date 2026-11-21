import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const OUTLINE = "#4a3426";

export function LlamaHead(props: IconProps) {
  const fluff = [
    [21, 25, 6.5], [27, 19.5, 6.5], [34, 18, 6.8], [41, 20.5, 6.3], [45.5, 26, 5.5], [17.5, 31, 5],
  ];
  const shapes = <>
    <ellipse cx="17" cy="15" rx="5.2" ry="12" transform="rotate(-22 17 15)" />
    <ellipse cx="47" cy="15" rx="5.2" ry="12" transform="rotate(22 47 15)" />
    <ellipse cx="32" cy="39" rx="17.5" ry="18" />
    {fluff.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
  </>;
  return <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
    <g fill={OUTLINE} stroke={OUTLINE} strokeWidth="3.4" strokeLinejoin="round">{shapes}</g>
    <g fill="#fdf3df">{shapes}</g>
    <ellipse cx="17" cy="15.5" rx="2.4" ry="7.5" transform="rotate(-22 17 15.5)" fill="#f6b7ad" />
    <ellipse cx="47" cy="15.5" rx="2.4" ry="7.5" transform="rotate(22 47 15.5)" fill="#f6b7ad" />
    <g fill="#f8e6c6">
      <circle cx="27" cy="21" r="3.2" /><circle cx="36" cy="19.5" r="3.4" /><circle cx="42" cy="23" r="2.6" />
    </g>
    <ellipse cx="33" cy="47" rx="10" ry="7.5" fill="#fffaf0" />
    <path d="M21.5 38.5q3.2-3.6 6.4 0M37 38.5q3.2-3.6 6.4 0" fill="none" stroke={OUTLINE} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M30.5 43.5h5l-2.5 2.4z" fill={OUTLINE} strokeLinejoin="round" stroke={OUTLINE} strokeWidth="1" />
    <path d="M27.5 47.5q5.5 6.5 11 0" fill="#e2645b" stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round" />
    <ellipse cx="20" cy="44.5" rx="3.6" ry="2.3" fill="#f59b92" opacity=".55" />
    <ellipse cx="45" cy="44.5" rx="3.6" ry="2.3" fill="#f59b92" opacity=".55" />
  </svg>;
}

export function Flame(props: IconProps) {
  return <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
    <defs>
      <linearGradient id="rl-flame-outer" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffb02e" /><stop offset="1" stopColor="#f2541b" />
      </linearGradient>
      <linearGradient id="rl-flame-inner" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff3a8" /><stop offset="1" stopColor="#ffc531" />
      </linearGradient>
    </defs>
    <path d="M16 2c1.6 4.6 7 7.6 8.6 12.6 1.8 5.8-1.6 14.4-8.6 14.4S5.2 24.4 6.8 18.6c.9-3.3 3-5 4.4-7.2.6 2.2 1.3 3.4 2.6 4.2C13.2 10.6 14 6.4 16 2z" fill="url(#rl-flame-outer)" />
    <path d="M16.4 14.5c1 2.8 4.4 4.6 4.2 8.2-.2 3-2.2 5-4.6 5s-4.6-1.8-4.6-4.6c0-2.6 1.8-3.5 2.6-5.3.5 1.2 1 1.8 1.7 2.1.1-2 .2-3.6.7-5.4z" fill="url(#rl-flame-inner)" />
  </svg>;
}

export function Sparkle(props: IconProps) {
  return <svg viewBox="0 0 40 40" aria-hidden="true" {...props}>
    <g stroke="#ffc21a" strokeWidth="4.4" strokeLinecap="round">
      <path d="M12 4l3 9" /><path d="M24 14l10-5" /><path d="M20 26l12 2" />
    </g>
  </svg>;
}

export function Star(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M12 1.8l3 6.4 7 .8-5.2 4.8 1.4 7L12 17.3 5.8 20.8l1.4-7L2 9l7-.8z" fill="#ffcf24" stroke="#f0a90e" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M9.6 9.4l2.2-4" stroke="#fff6b8" strokeWidth="1.6" strokeLinecap="round" />
  </svg>;
}

export function Trophy(props: IconProps) {
  return <svg viewBox="0 0 160 140" aria-hidden="true" {...props}>
    <defs>
      <linearGradient id="rl-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffe066" /><stop offset=".55" stopColor="#ffbf1f" /><stop offset="1" stopColor="#e59400" />
      </linearGradient>
      <radialGradient id="rl-glow">
        <stop offset="0" stopColor="#fff4c2" /><stop offset="1" stopColor="#fff4c2" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="80" cy="64" r="62" fill="url(#rl-glow)" />
    <g stroke="#ffc21a" strokeWidth="5" strokeLinecap="round">
      <path d="M80 6v12" /><path d="M42 18l7 9" /><path d="M118 18l-7 9" />
      <path d="M22 46l11 4" /><path d="M138 46l-11 4" /><path d="M26 74l10-2" /><path d="M134 74l-10-2" />
    </g>
    <ellipse cx="80" cy="126" rx="44" ry="11" fill="#fff" />
    <ellipse cx="60" cy="120" rx="18" ry="10" fill="#fff" /><ellipse cx="100" cy="120" rx="18" ry="10" fill="#fff" />
    <g fill="#5fb63a">
      {[0, 1, 2, 3].map((i) => <ellipse key={`l${i}`} cx={44 - i * 3} cy={104 - i * 12} rx="5" ry="9"
        transform={`rotate(${-35 + i * 12} ${44 - i * 3} ${104 - i * 12})`} />)}
      {[0, 1, 2, 3].map((i) => <ellipse key={`r${i}`} cx={116 + i * 3} cy={104 - i * 12} rx="5" ry="9"
        transform={`rotate(${35 - i * 12} ${116 + i * 3} ${104 - i * 12})`} />)}
    </g>
    <path d="M50 34c-14 0-18 8-16 16 2.5 10 14 14 22 14" fill="none" stroke="#e8a106" strokeWidth="7" strokeLinecap="round" />
    <path d="M110 34c14 0 18 8 16 16-2.5 10-14 14-22 14" fill="none" stroke="#e8a106" strokeWidth="7" strokeLinecap="round" />
    <path d="M50 28h60v14c0 20-13 34-30 34S50 62 50 42z" fill="url(#rl-gold)" stroke="#c97f00" strokeWidth="2" />
    <path d="M73 74h14l3 18H70z" fill="#f0a90e" />
    <rect x="58" y="92" width="44" height="14" rx="4" fill="#7a4a1d" />
    <rect x="64" y="95" width="32" height="7" rx="2" fill="#ffcf24" />
    <path d="M80 36l4.4 9 9.6 1.2-7 6.6 1.8 9.6L80 57.6l-8.8 4.8 1.8-9.6-7-6.6 9.6-1.2z" fill="#fff6c4" />
    <path d="M57 34v12c0 6 2 11 5 15" fill="none" stroke="#fff6c4" strokeWidth="3.4" strokeLinecap="round" opacity=".8" />
  </svg>;
}

export function Signpost(props: IconProps) {
  return <svg viewBox="0 0 90 110" aria-hidden="true" {...props}>
    <ellipse cx="44" cy="102" rx="38" ry="8" fill="#a9d977" />
    <rect x="38" y="30" width="11" height="72" rx="3" fill="#8b5a2b" />
    <rect x="41" y="30" width="3" height="72" fill="#a86f38" />
    <path d="M6 14l70-8 4 36-70 8z" fill="#9c6533" stroke="#6e4220" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M14 42l14-18 9 10 6-6 14 14z" fill="#f4e8d2" />
    <path d="M26 26l2-2 3 3z" fill="#fff" />
    <path d="M58 18h10" stroke="#f4e8d2" strokeWidth="3" strokeLinecap="round" />
    <path d="M63 18v-6l8 3z" fill="#f4e8d2" />
  </svg>;
}

export function Flower(props: IconProps) {
  return <svg viewBox="0 0 40 40" aria-hidden="true" {...props}>
    {[0, 72, 144, 216, 288].map((angle) => <ellipse key={angle} cx="20" cy="10" rx="7" ry="9" fill="#fff"
      stroke="#e6e0d0" strokeWidth="1" transform={`rotate(${angle} 20 20)`} />)}
    <circle cx="20" cy="20" r="5.5" fill="#ffcc2e" />
  </svg>;
}

export function Confetti(props: IconProps) {
  return <svg viewBox="0 0 60 50" aria-hidden="true" {...props}>
    <g strokeWidth="3.6" strokeLinecap="round">
      <path d="M8 6l7 6" stroke="#ff5b6e" /><path d="M30 4l-2 9" stroke="#ffc21a" />
      <path d="M48 10l-8 5" stroke="#21b07c" /><path d="M14 30l8-3" stroke="#3aa0ff" />
      <path d="M44 34l7 4" stroke="#ff8a2a" />
    </g>
    <circle cx="4" cy="22" r="2.6" fill="#ffc21a" /><circle cx="54" cy="24" r="2.6" fill="#ff5b6e" />
    <circle cx="30" cy="40" r="2.4" fill="#21b07c" />
  </svg>;
}

export function Landscape(props: IconProps) {
  return <svg viewBox="0 0 360 440" preserveAspectRatio="none" aria-hidden="true" {...props}>
    <g fill="#cfeaa8" opacity=".85">
      <ellipse cx="40" cy="150" rx="70" ry="42" /><ellipse cx="96" cy="140" rx="46" ry="36" />
    </g>
    <g fill="#b6de85">
      <ellipse cx="30" cy="160" rx="54" ry="26" /><ellipse cx="88" cy="160" rx="40" ry="22" />
    </g>
    <g fill="#9bd06b">
      <circle cx="66" cy="148" r="6" /><circle cx="78" cy="152" r="5" /><circle cx="90" cy="148" r="6" />
    </g>
    <path d="M-10 300c40-20 70-10 90 10 20 18 10 40-20 50-30 8-70 2-70 2z" fill="#d7efb6" />
    <path d="M200 440c30-60 80-90 170-80v80z" fill="#cdeba5" />
    <g fill="#a7d872">
      <ellipse cx="320" cy="368" rx="44" ry="34" /><ellipse cx="282" cy="380" rx="30" ry="22" /><ellipse cx="350" cy="350" rx="26" ry="30" />
    </g>
    <g fill="#8cc95a">
      <ellipse cx="316" cy="380" rx="30" ry="18" />
    </g>
    <path d="M-10 440c20-50 60-60 120-52 40 6 50 30 40 52z" fill="#d7efb6" />
  </svg>;
}
