// Funciones puras de las consultas: agregados de /hoy, la cola de 14 días, la gráfica y los filtros de /videos.
import { describe, expect, it } from "vitest";
import { cifrasVacias, type Fuente } from "../tipos";
import { armarCola } from "./cola";
import type { LecturaDato } from "./cifras";
import { sinDato } from "./cifras";
import type { PublicacionFila, ReelFila } from "./datos";
import { armarFilasCrecimiento } from "./detalle";
import { agregar, lecturaVencida, variacion, vistasEn } from "./hoy";
import { leerFiltros, ordenar, type FilaVideo } from "./videos";

const t = (iso: string) => new Date(iso);

function pub(id: number, parcial: Partial<PublicacionFila>): PublicacionFila {
  return {
    id,
    reelId: "10",
    red: "tiktok",
    cuenta: null,
    postIdPlataforma: null,
    zernioPostId: null,
    etiquetas: [],
    enlace: null,
    texto: null,
    duracionS: null,
    programadoPara: null,
    publicadoEn: null,
    estado: "programado",
    origen: "zernio",
    emparejadoPor: null,
    marcaIa: null,
    creadoEn: t("2026-11-01T00:00:00Z"),
    actualizadoEn: t("2026-11-01T00:00:00Z"),
    ...parcial,
  };
}

const reel = (id: string, gancho: string): ReelFila =>
  ({ id, gancho, avisos: [], estado: "listo", creadoEn: t("2026-11-01T00:00:00Z"), actualizadoEn: t("2026-11-01T00:00:00Z") }) as unknown as ReelFila;

const lect = (fuente: Fuente, datoEn: string, vistas: number | null): LecturaDato => ({
  ...cifrasVacias(),
  fuente,
  via: "api",
  datoActualizadoEn: t(datoEn),
  horasDesdePublicacion: null,
  vistas,
});

describe("agregar", () => {
  const c = (valor: number | null, fuente: Fuente, f: string) => ({ valor, fuente, datoActualizadoEn: t(f) });
  it("suma o promedia lo que existe, con la fecha más vieja", () => {
    const lista = [c(10, "meta", "2026-11-05T00:00:00Z"), c(30, "meta", "2026-11-03T00:00:00Z"), c(null, "meta", "2026-11-01T00:00:00Z")];
    expect(agregar(lista, "suma")).toEqual({ valor: 40, fuente: "meta", datoActualizadoEn: t("2026-11-03T00:00:00Z") });
    expect(agregar(lista, "promedio").valor).toBe(20);
  });
  it("sin valores queda sin dato (no 0)", () => {
    expect(agregar([], "suma")).toEqual(sinDato);
    expect(agregar([c(null, "meta", "2026-11-01T00:00:00Z")], "promedio")).toEqual(sinDato);
  });
  it("si se mezclan fuentes, manda la que no es manual", () => {
    expect(agregar([c(1, "manual", "2026-11-01T00:00:00Z"), c(2, "zernio", "2026-11-01T00:00:00Z")], "suma").fuente).toBe("zernio");
  });
});

describe("variacion", () => {
  it("cambio porcentual contra la semana anterior", () => {
    expect(variacion(150, 100)).toBe(50);
    expect(variacion(50, 100)).toBe(-50);
  });
  it("sin base no hay variación", () => {
    expect(variacion(10, null)).toBeNull();
    expect(variacion(10, 0)).toBeNull();
    expect(variacion(null, 10)).toBeNull();
  });
});

describe("vistasEn", () => {
  const ls = [lect("zernio", "2026-11-02T00:00:00Z", 100), lect("zernio", "2026-11-04T00:00:00Z", 300), lect("zernio", "2026-11-05T00:00:00Z", null)];
  it("antes de publicarse son 0 (un hecho, no un relleno)", () => {
    expect(vistasEn(ls, t("2026-11-03T00:00:00Z"), t("2026-11-02T00:00:00Z"))).toBe(0);
  });
  it("después, la última lectura vigente en ese instante", () => {
    expect(vistasEn(ls, t("2026-11-01T00:00:00Z"), t("2026-11-03T00:00:00Z"))).toBe(100);
    expect(vistasEn(ls, t("2026-11-01T00:00:00Z"), t("2026-11-06T00:00:00Z"))).toBe(300);
  });
  it("si ya estaba publicada y no hay lectura anterior, no se sabe", () => {
    expect(vistasEn(ls, t("2026-10-20T00:00:00Z"), t("2026-11-01T00:00:00Z"))).toBeNull();
  });
});

describe("lecturaVencida", () => {
  const ahora = t("2026-11-06T12:00:00Z");
  it("más de 24 h o ninguna lectura", () => {
    expect(lecturaVencida(t("2026-11-05T11:59:00Z"), ahora)).toBe(true);
    expect(lecturaVencida(t("2026-11-05T12:01:00Z"), ahora)).toBe(false);
    expect(lecturaVencida(null, ahora)).toBe(true);
  });
});

describe("armarCola", () => {
  // Hoy en Bogotá: 6-nov-2026.
  const hoy = "2026-11-06";
  const reels = [reel("14", "Gancho 14"), reel("15", "Gancho 15")];

  it("arma 14 días desde hoy con las publicaciones por día y por red", () => {
    const c = armarCola(
      [
        pub(1, { red: "tiktok", reelId: "14", programadoPara: t("2026-11-07T00:30:00Z") }), // 6-nov 19:30 Bogotá
        pub(2, { red: "instagram", reelId: "14", programadoPara: t("2026-11-07T00:30:00Z"), estado: "borrador" }),
        pub(3, { red: "tiktok", reelId: "15", programadoPara: t("2026-11-30T00:00:00Z") }), // fuera de la ventana
      ],
      reels,
      hoy,
    );
    expect(c.dias).toHaveLength(14);
    expect(c.dias[0]?.dia).toBe("2026-11-06");
    expect(c.dias[13]?.dia).toBe("2026-11-19");
    expect(c.dias[0]?.redes.tiktok.map((i) => i.reelId)).toEqual(["14"]);
    expect(c.dias[0]?.redes.instagram[0]?.estado).toBe("borrador");
    expect(c.dias[0]?.redes.facebook).toEqual([]);
  });

  it("avisa de dos el mismo día en la misma red, pero no si son de redes distintas", () => {
    const c = armarCola(
      [
        pub(1, { red: "tiktok", reelId: "14", programadoPara: t("2026-11-07T15:00:00Z") }),
        pub(2, { red: "tiktok", reelId: "15", programadoPara: t("2026-11-07T23:00:00Z") }),
        pub(3, { red: "instagram", reelId: "14", programadoPara: t("2026-11-08T15:00:00Z") }),
        pub(4, { red: "facebook", reelId: "14", programadoPara: t("2026-11-08T16:00:00Z") }),
      ],
      reels,
      hoy,
    );
    const dia7 = c.dias.find((d) => d.dia === "2026-11-07");
    expect(dia7?.avisos.map((a) => a.tipo)).toEqual(["doble"]);
    const dia8 = c.dias.find((d) => d.dia === "2026-11-08");
    expect(dia8?.avisos).toEqual([]);
  });

  it("avisa del día sin video", () => {
    const c = armarCola([pub(1, { reelId: "14", programadoPara: t("2026-11-07T15:00:00Z") })], reels, hoy);
    expect(c.dias[0]?.avisos.map((a) => a.tipo)).toEqual(["sin_video"]);
    expect(c.dias[1]?.avisos).toEqual([]);
  });

  it("avisa de una publicación fallida, también la reciente que quedó atrás", () => {
    const c = armarCola(
      [
        pub(1, { reelId: "14", estado: "fallido", programadoPara: t("2026-11-07T15:00:00Z") }),
        pub(2, { reelId: "15", estado: "fallido", programadoPara: t("2026-11-03T15:00:00Z") }),
        pub(3, { reelId: "15", estado: "fallido", programadoPara: t("2026-10-01T15:00:00Z") }),
      ],
      reels,
      hoy,
    );
    expect(c.dias[1]?.avisos.map((a) => a.tipo)).toContain("fallida");
    expect(c.avisosFuera).toHaveLength(1);
  });

  it("las canceladas y borradas no cuentan, y un día solo con una cancelada sigue sin video", () => {
    const c = armarCola([pub(1, { reelId: "14", estado: "cancelado", programadoPara: t("2026-11-06T15:00:00Z") })], reels, hoy);
    expect(c.dias[0]?.avisos.map((a) => a.tipo)).toEqual(["sin_video"]);
  });
});

describe("armarFilasCrecimiento", () => {
  it("junta las series por hora y deja null donde una serie no tiene punto", () => {
    const filas = armarFilasCrecimiento({
      tiktok: [
        { horas: 10, valor: 100 },
        { horas: 48, valor: 500 },
      ],
      instagram: [{ horas: 48, valor: 300 }],
    });
    expect(filas).toEqual([
      { horas: 10, tiktok: 100, instagram: null },
      { horas: 48, tiktok: 500, instagram: 300 },
    ]);
  });
});

describe("leerFiltros", () => {
  it("lee momento, filtros y orden de la URL", () => {
    const f = leerFiltros({ momento: "48h", formato: "dialogo", red: "instagram", desde: "2026-11-01", orden: "instagram_vistas", dir: "asc" });
    expect(f).toMatchObject({ momento: "48h", formato: "dialogo", red: "instagram", desde: "2026-11-01", orden: "instagram_vistas", dir: "asc" });
  });
  it("descarta lo que no sirve y usa los valores por defecto", () => {
    const f = leerFiltros({ momento: "nunca", formato: "todos", desde: "ayer", orden: "x; drop", dir: ["raro"] });
    expect(f).toEqual({
      momento: "ultima",
      formato: undefined,
      voz: undefined,
      red: undefined,
      desde: undefined,
      hasta: undefined,
      orden: "fecha",
      dir: "desc",
    });
  });
});

describe("armarCola: día sin video por celda", () => {
  const hoy = "2026-11-06";
  it("marca cada red sin publicaciones ese día, aunque otra red sí tenga", () => {
    const c = armarCola(
      [
        pub(1, { red: "tiktok", reelId: "14", programadoPara: t("2026-11-07T15:00:00Z") }),
        pub(2, { red: "instagram", reelId: "14", programadoPara: t("2026-11-07T15:00:00Z") }),
      ],
      [reel("14", "g")],
      hoy,
    );
    expect(c.dias[1]?.sinVideo).toEqual(["facebook"]);
    expect(c.dias[2]?.sinVideo).toEqual(["tiktok", "instagram", "facebook"]);
  });
  it("una cancelada no cuenta como video", () => {
    const c = armarCola([pub(1, { estado: "cancelado", programadoPara: t("2026-11-06T15:00:00Z") })], [reel("10", "g")], hoy);
    expect(c.dias[0]?.sinVideo).toContain("tiktok");
  });
});

describe("ordenar /videos por fecha", () => {
  const fila = (id: string, fecha: string | null, publicado: boolean): FilaVideo =>
    ({ reel: { id }, fecha, publicado, redes: { tiktok: null, instagram: null, facebook: null } }) as unknown as FilaVideo;
  const filas = [fila("a", "2026-11-03", true), fila("f", "2026-11-20", false), fila("b", "2026-11-05", true), fila("g", null, false)];
  it("por defecto (desc): publicados por fecha descendente y los futuros al final", () => {
    expect(ordenar(filas, "fecha", -1).map((f) => f.reel.id)).toEqual(["b", "a", "f", "g"]);
  });
  it("asc: publicados del más viejo al más nuevo, los futuros siguen al final", () => {
    expect(ordenar(filas, "fecha", 1).map((f) => f.reel.id)).toEqual(["a", "b", "f", "g"]);
  });
});

describe("cola: borradores editables (T15)", () => {
  const hoy = "2026-11-06";
  const base = { estado: "borrador" as const, origen: "zernio" as const, zernioPostId: "z1", texto: "hola", programadoPara: new Date("2026-11-07T15:00:00Z") };
  it("marca editable solo TikTok/Instagram, borrador, de Zernio y con id", () => {
    const c = armarCola(
      [
        pub(1, { ...base, red: "tiktok" }),
        pub(2, { ...base, red: "instagram", zernioPostId: null }),
        pub(3, { ...base, red: "facebook" }),
        pub(4, { ...base, red: "instagram", estado: "programado" }),
        pub(5, { ...base, red: "instagram", origen: "meta" }),
      ],
      [],
      hoy,
    );
    const items = c.dias.flatMap((d) => Object.values(d.redes).flat());
    const por = (id: number) => items.find((i) => i.publicacionId === id);
    expect(por(1)?.editable).toBe(true);
    expect(por(1)?.texto).toBe("hola");
    expect(por(2)?.editable).toBe(false);
    expect(por(3)?.editable).toBe(false);
    expect(por(3)?.soloMeta).toBe(true);
    expect(por(4)?.editable).toBe(false);
    expect(por(5)?.editable).toBe(false);
  });
});
