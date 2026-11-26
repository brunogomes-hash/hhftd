import { describe, it, expect, beforeEach } from "vitest";
import { podeComemorarHora, podeComemorarNaTela, proximaFala } from "./comemoracao";
import type { HoraLinha } from "./produtividade";

const linha: HoraLinha = { hora: 10, meta: 100, real: 100, atual: false, idealAgora: 100, status: "dentro" };
describe("alerta no fechamento da hora", () => {
  it("comemora uma hora fechada que bateu 100%", () => expect(podeComemorarHora(linha, 11)).toBe(true));
  it("comemora hora fechada que passou da meta", () => expect(podeComemorarHora({ ...linha, real: 137 }, 11)).toBe(true));
  it("não comemora hora fechada a 99% (dentro pela faixa, mas sem meta batida)", () => expect(podeComemorarHora({ ...linha, real: 99 }, 11)).toBe(false));
  it("não comemora a hora em andamento mesmo com 100%", () => expect(podeComemorarHora({ ...linha, real: 100, atual: true }, 10)).toBe(false));
  it("não comemora hora fechada fora a 94%", () => expect(podeComemorarHora({ ...linha, real: 94 }, 11)).toBe(false));
  it("não comemora horas antigas", () => expect(podeComemorarHora(linha, 12)).toBe(false));
  it("às 22h comemora o fechamento da última hora, 21:00", () =>
    expect(podeComemorarHora({ ...linha, hora: 21 }, 22)).toBe(true));
  it("não comemora horas fora da grade após o encerramento", () => {
    expect(podeComemorarHora({ ...linha, hora: 22 }, 23)).toBe(false);
    expect(podeComemorarHora({ ...linha, hora: 23 }, 0)).toBe(false);
  });
  it("não comemora intervalo sem meta", () => expect(podeComemorarHora({ ...linha, meta: 0 }, 11)).toBe(false));
  it("comemora B2C apenas na tela B2C", () => {
    expect(podeComemorarNaTela(linha, 11, "B2C", "B2C", true)).toBe(true);
    expect(podeComemorarNaTela(linha, 11, "B2C", "B2B", true)).toBe(false);
  });
  it("comemora B2B apenas na tela B2B", () => {
    expect(podeComemorarNaTela(linha, 11, "B2B", "B2B", true)).toBe(true);
    expect(podeComemorarNaTela(linha, 11, "B2B", "B2C", true)).toBe(false);
  });
  it("não comemora enquanto a página estiver oculta", () => {
    expect(podeComemorarNaTela(linha, 11, "B2B", "B2B", false)).toBe(false);
  });
});

describe("fala da raposa na meta batida", () => {
  beforeEach(() => localStorage.clear());
  it("gira as 6 gravações, uma por comemoração", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(() => proximaFala())).toEqual([0, 1, 2, 3, 4, 5, 0, 1]);
  });
});
