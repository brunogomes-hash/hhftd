import { isDiaUtil } from "./feriados";
import { monthForecast, type Forecast, type OrderRow } from "./logistics";

export interface ResumoCanal {
  forecastDia: number;
  realPorHora: Record<number, number>;
  caixa: { pecas: number; pedidos: number };
  /** Peças que estavam disponíveis (importadas e ainda não faturadas) em cada hora do dia. */
  volumePorHora?: Record<number, number>;
  atualizadoEm: string;
}

/** Dias úteis (seg–sáb, sem feriados) do mês "yyyy-mm". */
export function diasUteisMes(month: string) {
  const [y, m] = month.split("-").map(Number);
  const dim = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= dim; d++) if (isDiaUtil(new Date(Date.UTC(y!, m! - 1, d)).toISOString())) n++;
  return n;
}

/** B2C: produzido = peças faturadas (conferência concluída) por hora no dia;
 *  caixa = pedidos B2C ainda não faturados; forecast do dia = forecast do mês ÷ dias úteis. */
export function resumoB2C(rows: OrderRow[], fc: Forecast, dia: string): ResumoCanal {
  const realPorHora: Record<number, number> = {};
  const pend = new Set<string>();
  let pecas = 0;
  for (const r of rows) {
    if (r.grupo !== "B2C") continue;
    if (!r.faturado) {
      pend.add(r.notaFiscal ?? r.pedido);
      pecas += r.pecas;
      continue;
    }
    if (!r.faturadoEm || r.faturadoEm.slice(0, 10) !== dia) continue;
    const h = Number(r.faturadoEm.slice(11, 13));
    realPorHora[h] = (realPorHora[h] ?? 0) + r.pecas;
  }
  const volumePorHora: Record<number, number> = {};
  for (let h = 6; h <= 21; h++) {
    const ini = `${dia}T${String(h).padStart(2, "0")}:00`;
    const fim = `${dia}T${String(h + 1).padStart(2, "0")}:00`;
    let v = 0;
    for (const r of rows) {
      if (r.grupo !== "B2C") continue;
      if (r.importadoEm && r.importadoEm >= fim) continue;
      if (r.faturado && (!r.faturadoEm || r.faturadoEm < ini)) continue;
      v += r.pecas;
    }
    volumePorHora[h] = v;
  }
  const mes = dia.slice(0, 7);
  const du = diasUteisMes(mes);
  return {
    forecastDia: isDiaUtil(dia) && du ? Math.round(monthForecast(fc, mes, "B2C") / du) : 0,
    realPorHora,
    caixa: { pecas, pedidos: pend.size },
    volumePorHora,
    atualizadoEm: new Date().toISOString(),
  };
}

/** B2B: produzido = soma de todos os usuários nas linhas PACKING com Tipo do Pedido B2B,
 *  por hora (colunas PECAS_00H..PECAS_23H) da aba de produtividade; caixa = B2B ainda não faturado na base. */
export function resumoB2B(prodCsv: string[][], rows: OrderRow[], fc: Forecast, dia: string): ResumoCanal {
  const [y, m, d] = dia.split("-");
  const dataBr = `${d}/${m}/${y}`;
  const head = prodCsv[0] ?? [];
  const col = (h: number) => head.findIndex((c) => c.trim().toUpperCase() === `PECAS_${String(h).padStart(2, "0")}H`);
  const realPorHora: Record<number, number> = {};
  for (const r of prodCsv.slice(1)) {
    if ((r[1] ?? "").trim().toUpperCase() !== "B2B") continue;
    if (!(r[0] ?? "").toUpperCase().includes("PACKING")) continue;
    if (!(r[2] ?? "").trim().startsWith(dataBr)) continue;
    for (let h = 0; h < 24; h++) {
      const v = Number(r[col(h)] ?? 0) || 0;
      if (v) realPorHora[h] = (realPorHora[h] ?? 0) + v;
    }
  }
  const pend = new Set<string>();
  let pecas = 0;
  for (const r of rows) {
    if (r.grupo !== "B2B" || r.faturado) continue;
    pend.add(r.notaFiscal ?? r.pedido);
    pecas += r.pecas;
  }
  const mes = dia.slice(0, 7);
  const du = diasUteisMes(mes);
  return {
    forecastDia: isDiaUtil(dia) && du ? Math.round(monthForecast(fc, mes, "B2B") / du) : 0,
    realPorHora,
    caixa: { pecas, pedidos: pend.size },
    atualizadoEm: new Date().toISOString(),
  };
}
