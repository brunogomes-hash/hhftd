/** Feriados operacionais (yyyy-mm-dd): não contam como dia útil em forecast, ideal e SLA. */
export const FERIADOS = new Set<string>(["2026-11-02", "2026-11-21"]);

/** Dia útil = segunda a sábado e não feriado. */
export function isDiaUtil(iso: string) {
  return new Date(iso.slice(0, 10) + "T00:00:00Z").getUTCDay() !== 0 && !FERIADOS.has(iso.slice(0, 10));
}
