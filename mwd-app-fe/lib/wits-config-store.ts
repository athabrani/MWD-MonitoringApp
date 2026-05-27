export function formatConfiguredWitsId(numericId: number): string {
  return String(numericId).padStart(4, "0");
}
