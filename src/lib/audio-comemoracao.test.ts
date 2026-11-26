import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

describe("áudio da comemoração na TV", () => {
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();
  const players: { src: string; currentTime: number; volume: number; loop: boolean; onended: (() => void) | null; play: typeof play; pause: typeof pause }[] = [];

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    play.mockReset().mockResolvedValue(undefined);
    pause.mockClear();
    players.length = 0;
    vi.stubGlobal("Audio", class {
      src: string;
      currentTime = 0;
      volume = 1;
      loop = false;
      onended = null;
      play = play;
      pause = pause;
      constructor(src: string) { this.src = src; players.push(this); }
    });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("a fala começa junto com a raposa e os aplausos vêm depois, até 20 segundos", async () => {
    const { ativarAudio, tocarComemoracao } = await import("./audio-comemoracao");
    expect(await ativarAudio()).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    const falando = vi.fn();
    const erro = vi.fn();
    tocarComemoracao(2, falando, erro);
    const player = players[0];
    if (!player) throw new Error("Áudio não criado");
    expect(player.src).toContain("raposa-fala-3");
    expect(player.loop).toBe(false);
    expect(falando).toHaveBeenLastCalledWith(true);
    player.onended?.();
    expect(player.src).toContain("aplausos");
    expect(player.loop).toBe(true);
    expect(falando).toHaveBeenLastCalledWith(false);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(vi.getTimerCount()).toBe(0);
    expect(players).toHaveLength(1);
    expect(erro).not.toHaveBeenCalled();
  });

  it("informa quando a TV bloqueia o som, em vez de falhar silenciosamente", async () => {
    const { tocarComemoracao, audioLiberado } = await import("./audio-comemoracao");
    play.mockRejectedValue(new DOMException("Autoplay bloqueado", "NotAllowedError"));
    const erro = vi.fn();
    tocarComemoracao(0, vi.fn(), erro);
    await vi.advanceTimersByTimeAsync(0);
    expect(erro).toHaveBeenCalledOnce();
    expect(audioLiberado()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancela os sons pendentes quando a tela sai da comemoração", async () => {
    const { tocarComemoracao, pararAudio } = await import("./audio-comemoracao");
    tocarComemoracao(0, vi.fn(), vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    pararAudio();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(play).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});