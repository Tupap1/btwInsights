import { describe, expect, it } from "vitest";
import type { FilaListaComentarios } from "../normalizar/comentarios";
import { elegirHilos, MAX_HILOS_POR_CORRIDA, type HiloConocido } from "./comentarios";

const AHORA = new Date("2026-11-07T12:00:00Z");
const HORA = 3_600_000;

const cand = (publicacionId: number, conteo: number | null, creadoEn: string | null = "2026-11-05T12:00:00Z") => ({
  publicacionId,
  fila: {
    postId: `p${publicacionId}`,
    red: "instagram",
    cuentaId: "a",
    conteo,
    creadoEn: creadoEn === null ? null : new Date(creadoEn),
  } satisfies FilaListaComentarios,
});
const conocido = (conteoFuente: number | null, extra: Partial<HiloConocido> = {}): HiloConocido => ({
  conteoFuente,
  completo: true,
  leidoEn: new Date(AHORA.getTime() - HORA),
  ...extra,
});
const ids = (r: ReturnType<typeof elegirHilos>): number[] => r.map((c) => c.publicacionId);

describe("elegirHilos", () => {
  it("lee el que no tiene fila en hilo_comentarios", () => {
    expect(ids(elegirHilos([cand(1, 2)], new Map(), AHORA))).toEqual([1]);
  });

  it("no lee el que no cambió: mismo conteo, completo y leído hace menos de 24 h", () => {
    expect(elegirHilos([cand(1, 2)], new Map([[1, conocido(2)]]), AHORA)).toEqual([]);
  });

  it("lee el que cambió de conteo", () => {
    expect(ids(elegirHilos([cand(1, 3)], new Map([[1, conocido(2)]]), AHORA))).toEqual([1]);
  });

  it("lee el que quedó incompleto", () => {
    expect(ids(elegirHilos([cand(1, 2)], new Map([[1, conocido(2, { completo: false })]]), AHORA))).toEqual([1]);
  });

  it("lee el que se leyó hace más de 24 h, y el de exactamente 24 h todavía no", () => {
    const viejo = conocido(2, { leidoEn: new Date(AHORA.getTime() - 24 * HORA - 1) });
    const justo = conocido(2, { leidoEn: new Date(AHORA.getTime() - 24 * HORA) });
    expect(ids(elegirHilos([cand(1, 2)], new Map([[1, viejo]]), AHORA))).toEqual([1]);
    expect(elegirHilos([cand(1, 2)], new Map([[1, justo]]), AHORA)).toEqual([]);
  });

  it("no lee el de conteo 0 que nunca tuvo comentarios (sin fila o con fila de conteo 0)", () => {
    expect(elegirHilos([cand(1, 0)], new Map(), AHORA)).toEqual([]);
    const viejo = conocido(0, { leidoEn: new Date(AHORA.getTime() - 48 * HORA) });
    expect(elegirHilos([cand(1, 0)], new Map([[1, viejo]]), AHORA)).toEqual([]);
  });

  it("sí lee el de conteo 0 que antes tenía comentarios (pudieron borrarse)", () => {
    expect(ids(elegirHilos([cand(1, 0)], new Map([[1, conocido(4)]]), AHORA))).toEqual([1]);
  });

  it("con conteo desconocido (null) y sin fila, lee; con fila al día, no", () => {
    expect(ids(elegirHilos([cand(1, null)], new Map(), AHORA))).toEqual([1]);
    expect(elegirHilos([cand(1, null)], new Map([[1, conocido(null)]]), AHORA)).toEqual([]);
  });

  it("como mucho 30 por corrida, primero los posts más recientes; los sin fecha van al final", () => {
    const todos = Array.from({ length: 35 }, (_, i) =>
      cand(i + 1, 1, new Date(Date.UTC(2026, 9, 1) + i * 24 * HORA).toISOString()),
    );
    todos.push(cand(100, 1, null));
    const r = ids(elegirHilos(todos, new Map(), AHORA));
    expect(MAX_HILOS_POR_CORRIDA).toBe(30);
    expect(r).toHaveLength(30);
    expect(r[0]).toBe(35);
    expect(r[29]).toBe(6);
    expect(r).not.toContain(100);
  });
});
