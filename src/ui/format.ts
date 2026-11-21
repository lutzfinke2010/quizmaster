const points = new Intl.NumberFormat("de-DE");

export function formatPoints(value: number) {
  return points.format(value);
}
