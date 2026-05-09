export function colorForSeverity(severity: number): string {
  if (severity >= 85) return "#ff4f45";
  if (severity >= 70) return "#ffb238";
  if (severity >= 55) return "#f6d75f";
  return "#54e6ff";
}
