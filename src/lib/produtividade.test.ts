import { describe, expect, it } from "vitest";
import { humorRaposa, metaHora, montarPainel, painelFicticio, statusHora } from "./produtividade";

describe("status da hora", () => {
  it("abaixo de 95% da meta está fora", () => expect(statusHora(94, 100)).toBe("abaixo"));
  it("a partir de 95% está dentro", () => expect(statusHora(95, 100)).toBe("dentro"));
  it("fora sem volume disponível suficiente fica amarelo (sem volume)", () => expect(statusHora(60, 100, 60)).toBe("semVolume"));
  it("fora com volume disponível continua fora", () => expect(statusHora(60, 100, 300)).toBe("abaixo"));
  it("passar da meta também é dentro", () => expect(statusHora(130, 100)).toBe("dentro"));
});

describe("metas", () => {
  it("B2B fictício fica dentro da meta até a chegada dos dados reais", () => {
    const p = painelFicticio("B2B", new Date(2026, 10, 23, 11, 18));
    expect(p.atingido).toBe(1);
    expect(p.semVolume).toBe(false);
    expect(p.horas.filter((l) => l.meta > 0 && !l.atual && l.status !== "futura").every((l) => l.status === "dentro")).toBe(true);
    expect(p.horas.find((l) => l.hora === 6)?.real).toBe(metaHora(9600, 6));
  });
  it("12h (almoço) e 19h (janta) não têm meta", () => {
    expect(metaHora(14000, 12)).toBe(0);
    expect(metaHora(14000, 19)).toBe(0);
  });
  it.each(["B2C", "B2B"] as const)("%s exibe apenas 06:00 até 21:00", (canal) => {
    const p = montarPainel(canal, 14000, {}, 8, { pecas: 0, pedidos: 0 });
    expect(p.horas.map((l) => l.hora)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
  });
  it("a meta da hora é o forecast dividido pelas 14 horas produtivas", () => expect(metaHora(14000, 8)).toBe(1000));
  it("22h, 23h e meia-noite não recebem meta", () => {
    expect([22, 23, 0].map((h) => metaHora(14000, h))).toEqual([0, 0, 0]);
  });
  it("forecast até a última hora redonda soma só horas fechadas", () => {
    const p = montarPainel("B2C", 14000, { 6: 1000, 7: 800, 8: 500 }, 8, { pecas: 0, pedidos: 0 });
    expect(p.forecastAteAgora).toBe(metaHora(14000, 6) * 2);
    expect(p.realizadoAteAgora).toBe(1800);
  });
  it.each(["B2C", "B2B"] as const)("%s encerra às 22h e desconsidera produção posterior", (canal) => {
    const p = montarPainel(canal, 14000, { 21: 1000, 22: 2000, 23: 3000, 0: 4000 }, 22, { pecas: 0, pedidos: 0 });
    expect(p.horas.some((l) => l.atual || l.status === "futura")).toBe(false);
    expect(p.forecastAteAgora).toBe(14000);
    expect(p.realizadoAteAgora).toBe(1000);
  });
  it("hora atual compara com o ideal proporcional ao minuto", () => {
    const p = montarPainel("B2C", 14000, { 9: 480 }, 9, { pecas: 0, pedidos: 0 }, 30);
    const l = p.horas.find((x) => x.hora === 9);
    expect(l?.idealAgora).toBe(Math.round(metaHora(14000, 9) / 2));
    expect(l?.status).toBe("dentro");
  });
});

describe("humor da raposa", () => {
  it("dentro da meta fica feliz", () => expect(humorRaposa({ atingido: 1, semVolume: false, caixa: { pecas: 0, pedidos: 0 }, forecastAteAgora: 100, realizadoAteAgora: 100 })).toBe("feliz"));
  it("fora da meta com a caixa zerada vira 'Cadê os pedidos?', nunca brava", () =>
    expect(humorRaposa({ atingido: 0.5, semVolume: false, caixa: { pecas: 0, pedidos: 0 }, forecastAteAgora: 100, realizadoAteAgora: 50 })).toBe("cade"));
  it("fora da meta sem volume suficiente vira 'Cadê os pedidos?'", () =>
    expect(humorRaposa({ atingido: 0.5, semVolume: true, caixa: { pecas: 100, pedidos: 5 }, forecastAteAgora: 100, realizadoAteAgora: 50 })).toBe("cade"));
  it("fora da meta com a caixa com menos peças do que falta vira 'Cadê os pedidos?'", () =>
    expect(humorRaposa({ atingido: 0.5, semVolume: false, caixa: { pecas: 30, pedidos: 2 }, forecastAteAgora: 100, realizadoAteAgora: 50 })).toBe("cade"));
  it("fora da meta tendo peça na caixa para bater a meta fica brava", () =>
    expect(humorRaposa({ atingido: 0.5, semVolume: false, caixa: { pecas: 100, pedidos: 5 }, forecastAteAgora: 100, realizadoAteAgora: 50 })).toBe("brava"));
  it("painel com caixa menor que o que falta para a meta fica amarelo (sem volume)", () => {
    const p = montarPainel("B2C", 14000, { 6: 436 }, 7, { pecas: 100, pedidos: 1 });
    expect(p.forecastAteAgora - p.realizadoAteAgora).toBe(metaHora(14000, 6) - 436);
    expect(p.semVolume).toBe(true);
    expect(humorRaposa(p)).toBe("cade");
  });
  it("painel com caixa suficiente para a meta e hora fora fica brava", () => {
    const p = montarPainel("B2C", 14000, { 6: 436 }, 7, { pecas: 600, pedidos: 3 });
    expect(p.semVolume).toBe(false);
    expect(humorRaposa(p)).toBe("brava");
  });
});
