export type Canal = "B2B" | "B2C";
export type Status = "abaixo" | "semVolume" | "dentro" | "acima" | "futura";

/** Horas iniciadas das 06:00 às 21:00; turno encerra às 22:00, com dois intervalos sem meta. */
export const PESO_HORA: Record<number, number> = {
  6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1,
  12: 0, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1,
  19: 0, 20: 1, 21: 1,
};
/** Ordem de exibição: 06:00 … 21:00 (14 horas produtivas). */
export const HORAS = Array.from({ length: 16 }, (_, i) => i + 6);
/** "Dentro da meta" a partir de 95% do ideal (passar da meta também é dentro). */
export const FAIXA = { min: 0.95, max: 1.1 } as const;

export function statusHora(real: number, meta: number, volume?: number): Status {
  if (meta <= 0) return real > 0 ? "acima" : "dentro";
  const p = real / meta;
  // Abaixo de 95% é fora; daí para cima (inclusive passar da meta) é dentro.
  // Fora, mas sem volume disponível suficiente para bater a meta naquela hora = sem volume (amarelo).
  if (p >= FAIXA.min) return "dentro";
  return volume !== undefined && volume < meta * FAIXA.min ? "semVolume" : "abaixo";
}

/** Meta da hora = forecast do dia ÷ soma dos pesos × peso da hora. */
export function metaHora(forecastDia: number, hora: number) {
  const total = HORAS.reduce((a, h) => a + (PESO_HORA[h] ?? 0), 0);
  return Math.round((forecastDia / total) * (PESO_HORA[hora] ?? 0));
}

export interface HoraLinha { hora: number; meta: number; real: number; status: Status; atual: boolean; /** Ideal acumulado até o minuto atual (só na hora corrente; nas fechadas = meta). */ idealAgora: number }
export interface Painel {
  canal: Canal;
  forecastDia: number;
  forecastAteAgora: number;
  realizadoAteAgora: number;
  atingido: number; // 0..n
  /** Abaixo da meta só por falta de volume (nenhuma hora fechada ficou fora com volume disponível) ou com a caixa zerada. */
  semVolume: boolean;
  caixa: { pecas: number; pedidos: number };
  horas: HoraLinha[];
}

/** Às 22:00 fecha a última linha (21:00), sem criar uma linha das 22:00. */
export function horaAnterior(horaAtual: number): number | undefined {
  if (horaAtual === 22) return 21;
  const i = HORAS.indexOf(horaAtual);
  return i > 0 ? HORAS[i - 1] : undefined;
}

export function montarPainel(canal: Canal, forecastDia: number, realPorHora: Record<number, number>, horaAtual: number, caixa: Painel["caixa"], minuto = 0, volumePorHora?: Record<number, number>): Painel {
  // Posição da hora atual na operação; fora da grade todas as linhas estão fechadas.
  const posAtual = HORAS.indexOf(horaAtual);
  const pos = posAtual === -1 ? HORAS.length : posAtual;
  const horas = HORAS.map((h, i) => {
    const meta = metaHora(forecastDia, h);
    const real = realPorHora[h] ?? 0;
    const atual = i === posAtual;
    const idealAgora = atual ? Math.round((meta * minuto) / 60) : i < pos ? meta : 0;
    const vol = volumePorHora?.[h];
    const status: Status = i > pos ? "futura" : atual ? (minuto === 0 ? "futura" : statusHora(real, idealAgora, vol)) : statusHora(real, meta, vol);
    return { hora: h, meta, real, atual, idealAgora, status };
  });
  const fechadas = horas.filter((_, i) => i < pos);
  const forecastAteAgora = fechadas.reduce((a, l) => a + l.meta, 0);
  const realizadoAteAgora = fechadas.reduce((a, l) => a + l.real, 0);
  const atingido = forecastAteAgora ? realizadoAteAgora / forecastAteAgora : 1;
  const semVolume =
    atingido < FAIXA.min &&
    (caixa.pecas <= 0 ||
      caixa.pecas < forecastAteAgora - realizadoAteAgora ||
      (fechadas.some((l) => l.status === "semVolume") && !fechadas.some((l) => l.status === "abaixo")));
  return { canal, forecastDia, forecastAteAgora, realizadoAteAgora, atingido, semVolume, caixa, horas };
}

export type HumorRaposa = "feliz" | "cade" | "brava";
/** Dentro da meta = feliz; fora por falta de volume, com a caixa zerada ou com a caixa sem peças suficientes para cobrir o que falta = "Cadê os pedidos?"; só fica brava se a caixa tem peça para bater a meta e mesmo assim ficou fora. */
export function humorRaposa(p: Pick<Painel, "atingido" | "semVolume" | "caixa" | "forecastAteAgora" | "realizadoAteAgora">): HumorRaposa {
  if (p.atingido >= FAIXA.min) return "feliz";
  const falta = p.forecastAteAgora - p.realizadoAteAgora;
  if (p.semVolume || p.caixa.pecas <= 0 || p.caixa.pecas < falta) return "cade";
  return "brava";
}

/** Dados fictícios até a planilha ser conectada. */
export function painelFicticio(canal: Canal, agora: Date): Painel {
  const h = agora.getHours();
  const min = agora.getMinutes();
  const fc = canal === "B2C" ? 18400 : 9600;
  const fator = canal === "B2C"
    ? [1.04, 0.88, 1.12, 0.97, 1.01, 0.8, 0, 0.93, 1.06, 1.0, 0.86, 1.08, 1.02, 0, 0.95, 1.03, 0.9, 1.07, 0.98]
    : HORAS.map(() => 1);
  const real: Record<number, number> = {};
  const vol: Record<number, number> = {};
  HORAS.forEach((hr, i) => {
    const m = metaHora(fc, hr);
    const f = fator[i] ?? 1;
    // B2B simula a meta atingida até a chegada dos dados reais.
    vol[hr] = canal === "B2C" && f < 0.9 ? Math.round(m * f) : m * 3;
    if (hr < h) real[hr] = Math.round(m * f);
    else if (hr === h) real[hr] = Math.round(m * f * (min / 60));
  });
  const caixa = canal === "B2C" ? { pecas: 6230, pedidos: 1874 } : { pecas: 4115, pedidos: 96 };
  return montarPainel(canal, fc, real, h, caixa, min, vol);
}
