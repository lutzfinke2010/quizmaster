import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { formatPoints } from "../format";

/** Counts up from `from` to `value`; jumps directly with reduced motion. Screen readers get only the final value. */
export function AnimatedPoints({ value, from = value, format = formatPoints }: {
  value: number; from?: number; format?: (n: number) => string;
}) {
  const reduced = useReducedMotion();
  const counter = useMotionValue(from);
  const text = useTransform(counter, (n) => format(Math.round(n)));
  const previousRef = useRef(from);
  useEffect(() => {
    counter.set(previousRef.current);
    previousRef.current = value;
    if (reduced) { counter.set(value); return; }
    const animation = animate(counter, value, { duration: .85, ease: "easeOut" });
    return () => animation.stop();
  }, [value, counter, reduced]);
  return <span className="rl-animated-points" role="img" aria-label={format(value)}>
    {reduced ? <span aria-hidden="true">{format(value)}</span> : <motion.span aria-hidden="true">{text}</motion.span>}
  </span>;
}
