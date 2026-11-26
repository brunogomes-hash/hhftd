import { describe, expect, it } from "vitest";
import { resumoB2C } from "./resumo";
import type { OrderRow } from "./logistics";

const r = (o: Partial<OrderRow>): OrderRow => ({ pedido: "1", canal: "FTD-RESI", grupo: "B2C", status: "Em fluxo", pecas: 1, ...o });

describe("B2C da planilha Senior", () => {
  const rows = [
    r({ pedido: "a", faturado: true, faturadoEm: "2026-11-23T09:15", pecas: 5 }),
    r({ pedido: "b", faturado: true, faturadoEm: "2026-11-22T09:15", pecas: 7 }),
    r({ pedido: "c", faturado: false, pecas: 3 }),
    r({ pedido: "d", grupo: "B2B", faturado: true, faturadoEm: "2026-11-23T09:10", pecas: 50 }),
  ];
  const s = resumoB2C(rows, { "2026-11": { B2C: 12000 } }, "2026-11-23");
  it("produzido conta só B2C faturado no dia, na hora do faturamento", () => expect(s.realPorHora).toEqual({ 9: 5 }));
  it("caixa = B2C ainda não faturado", () => expect(s.caixa).toEqual({ pecas: 3, pedidos: 1 }));
  it("forecast do dia = mês ÷ dias úteis (nov/26: 23)", () => expect(s.forecastDia).toBe(522));
});

import { resumoB2B } from "./resumo";
describe("resumoB2B", () => {
  it("soma o Packing B2B de todos os usuários por hora, só do dia", () => {
    const head = ["Operação", "Tipo do Pedido", "Data", "u", "n", "TOTAL", ...Array.from({ length: 24 }, (_, h) => `PECAS_${String(h).padStart(2, "0")}H`)];
    const linha = (op: string, tipo: string, data: string, h: number, v: number) => {
      const r = [op, tipo, data, "x", "x", String(v), ...Array(24).fill("0")];
      r[6 + h] = String(v);
      return r;
    };
    const csv = [head,
      linha("PACKING - MULTI", "B2B", "24/11/2026 00:00:00", 8, 100),
      linha("PACKING - MULTI", "B2B", "24/11/2026 00:00:00", 8, 50),
      linha("SEPARACAO - MULTI", "B2B", "24/11/2026 00:00:00", 8, 999),
      linha("PACKING - COLMEIA", "B2C", "24/11/2026 00:00:00", 8, 999),
      linha("PACKING - MULTI", "B2B", "23/11/2026 00:00:00", 8, 999)];
    const r = resumoB2B(csv, [], {}, "2026-11-24");
    expect(r.realPorHora).toEqual({ 8: 150 });
  });
});
