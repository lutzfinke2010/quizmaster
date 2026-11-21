import type { ComponentType, SVGProps } from "react";
import type { QuizCategory } from "../domain/categories";
import { Paw, TeamTrio } from "./CreateIllustrations";
import { BookStack, Flask, Globe } from "./OverviewIllustrations";

const ICONS: Record<QuizCategory | string, ComponentType<SVGProps<SVGSVGElement>>> = {
  allgemeinwissen: BookStack,
  geografie: Globe,
  wissenschaft: Flask,
  "tiere-natur": Paw,
  "team-freunde": TeamTrio,
  Allgemeinwissen: BookStack,
  Geografie: Globe,
  Wissenschaft: Flask,
  "Tiere & Natur": Paw,
  "Team & Freunde": TeamTrio,
};

/** Illustration for a category id (labels are accepted too); unknown values fall back to the book stack. */
export function CategoryIcon({ category, ...props }: SVGProps<SVGSVGElement> & { category?: string | null }) {
  const Icon = (category && ICONS[category]) || BookStack;
  return <Icon aria-hidden="true" {...props} />;
}
