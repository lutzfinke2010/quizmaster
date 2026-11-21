import "./mascot.css";

export type MascotState = "intro" | "correct" | "wrong" | "celebration";

type Asset = { file: string; width: number; height: number; variants: number[]; fallback: number };

const BODY_HEIGHTS = [180, 300, 450, 640, 900];

/** Figures are cropped to their silhouette, so the same CSS height gives every pose the same scale. */
const MASCOTS: Record<MascotState, Asset & { alt: string }> = {
  intro: { file: "lama-winken", width: 813, height: 1526, variants: BODY_HEIGHTS, fallback: 450, alt: "RateLama begrüßt dich" },
  correct: { file: "lama-daumenhoch", width: 908, height: 1487, variants: BODY_HEIGHTS, fallback: 450, alt: "RateLama freut sich über die richtige Antwort" },
  wrong: { file: "lama-falsch-antwort", width: 759, height: 1364, variants: BODY_HEIGHTS, fallback: 450, alt: "RateLama nimmt die falsche Antwort gelassen" },
  celebration: { file: "lama-jubel", width: 893, height: 1450, variants: BODY_HEIGHTS, fallback: 450, alt: "RateLama jubelt zum Quizabschluss" },
};

const HEAD: Asset = { file: "lama-kopf-avatar", width: 818, height: 1222, variants: [64, 128, 192, 256], fallback: 128 };

/**
 * Palette-quantised PNG variants by height. Deliberately PNG rather than WebP: the Amplify SPA rewrite
 * (see README) serves `index.html` for file types outside its allow-list, which breaks the image.
 */
function sources({ file, width, height, variants, fallback }: Asset, size: number) {
  const base = `${import.meta.env.BASE_URL}assets/ratelama/mascots/${file}`;
  return {
    src: `${base}-${fallback}.png`,
    srcSet: variants.map((h) => `${base}-${h}.png ${Math.round(width * h / height)}w`).join(", "),
    sizes: `${Math.ceil(size * width / height)}px`,
  };
}

/**
 * The RateLama mascot from `spec/ratelama-llama-spec`.
 * Size it via CSS `height` (width follows); `size` is the largest rendered height in CSS pixels and only
 * picks the right image variant. Pass `decorative` when a heading next to it already says the same.
 */
export function RateLamaMascot({ state, className = "", size = 160, decorative = false }: {
  state: MascotState; className?: string; size?: number; decorative?: boolean;
}) {
  const mascot = MASCOTS[state];
  return <img className={`quiz-mascot quiz-mascot-${state} ${className}`.trim()} {...sources(mascot, size)}
    width={mascot.width} height={mascot.height} alt={decorative ? "" : mascot.alt} draggable={false} decoding="async" />;
}

/** The head avatar used as the RateLama logo mark. Always decorative: the brand name sits next to it. */
export function RateLamaHead({ className = "", size = 56 }: { className?: string; size?: number }) {
  return <img className={`rl-lama-head ${className}`.trim()} {...sources(HEAD, size)}
    width={HEAD.width} height={HEAD.height} alt="" draggable={false} />;
}

/** Warms the cache for poses that appear after a user action, so they don't pop in late on mobile networks. */
export function preloadMascots(states: MascotState[], size = 160) {
  if (typeof Image === "undefined") return;
  for (const state of states) {
    const image = new Image();
    const { srcSet, sizes } = sources(MASCOTS[state], size);
    image.sizes = sizes;
    image.srcset = srcSet;
  }
}
