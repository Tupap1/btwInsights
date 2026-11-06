import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PostLeido } from "../tipos";
import { leerMetricasCsv } from "./metricas-csv";

const dir = path.join(process.cwd(), "pruebas/fixtures/btw-videos/publicar/metricas");
const leidoEn = new Date("2026-11-05T23:00:00Z");
const posts = leerMetricasCsv(readFileSync(path.join(dir, "2026-11-05.csv"), "utf8"), leidoEn);
const post = (id: string): PostLeido => {
  const p = posts.find((x) => x.publicacion.postIdPlataforma === id);
  if (!p) throw new Error(`falta el post ${id}`);
  return p;
};

describe("leerMetricasCsv con los datos reales", () => {
  it("lee 28 posts: 9 de TikTok, 11 de Facebook y 8 de Instagram, sin errores", () => {
    expect(posts).toHaveLength(28);
    const porRed = (red: string) => posts.filter((p) => p.publicacion.red === red).length;
    expect(porRed("tiktok")).toBe(9);
    expect(porRed("facebook")).toBe(11);
    expect(porRed("instagram")).toBe(8);
    for (const p of posts) expect(p.lectura?.errores).toEqual([]);
  });

  it("campos de la publicación", () => {
    const p = post("7704758213807312180").publicacion;
    expect(p.origen).toBe("zernio");
    expect(p.zernioPostId).toBeNull();
    expect(p.estado).toBe("publicado");
    expect(p.publicadoEn?.toISOString()).toBe("2026-11-05T18:36:00.000Z");
    expect(p.duracionS).toBe(43.286);
    expect(p.texto).toHaveLength(60);
    expect(post("1091172913760322").publicacion.origen).toBe("meta");
    expect(post("18120342799999707").publicacion.duracionS).toBeNull();
  });

  it("Facebook: interacciones desde el JSON", () => {
    const l = post("1091172913760322").lectura;
    expect(l?.via).toBe("csv");
    expect(l?.fuente).toBe("meta");
    expect(l?.cifras.interacciones).toBe(1);
    expect(l?.cifras.comentarios).toBe(1);
    expect(l?.cifras.compartidos).toBeNull();
    expect(l?.cifras.reproduccionesConRepeticion).toBe(192);
    expect(l?.datoActualizadoEn).toEqual(leidoEn);
    // "{}" significa 0 interacciones.
    expect(post("1458288679592811").lectura?.cifras.interacciones).toBe(0);
  });

  it("TERROR02 de TikTok: ret1s, ret3s y ret5s en null y ret10s en 7", () => {
    const l = post("7702305446215847174").lectura;
    expect(l?.cifras.ret1s).toBeNull();
    expect(l?.cifras.ret3s).toBeNull();
    expect(l?.cifras.ret5s).toBeNull();
    expect(l?.cifras.ret10s).toBe(7);
    expect(l?.cifras.vistas).toBe(177);
    expect(l?.datoActualizadoEn.toISOString()).toBe("2026-11-05T22:49:29.000Z");
    expect(l?.paisPrincipal).toEqual({ codigo: "CO", pct: 94.6 });
    // solo los puntos que vienen, de 0-1 a 0-100
    expect(l?.curva?.["0"]).toBe(100);
    expect(l?.curva?.["2"]).toBe(46);
    expect(l?.curva?.["1"]).toBeUndefined();
  });

  it("alcance 0 de TikTok con vistas → null; con alcance real se conserva", () => {
    expect(post("7704758213807312180").lectura?.cifras.alcance).toBeNull();
    expect(post("7704035139474509076").lectura?.cifras.alcance).toBe(122);
    expect(post("7704035139474509076").lectura?.paisPrincipal).toEqual({ codigo: "CO", pct: 96.3 });
    expect(post("7704758213807312180").lectura?.paisPrincipal).toBeNull();
  });

  it("Instagram: interacciones numéricas y vacíos en null", () => {
    const l = post("18120342799999707").lectura;
    expect(l?.cifras.interacciones).toBe(9);
    expect(l?.cifras.compartidos).toBe(1);
    expect(l?.cifras.seguidoresGanados).toBeNull();
    expect(l?.curva).toBeNull();
  });
});

describe("leerMetricasCsv con entradas pequeñas", () => {
  const cabecera =
    "red,fuente,id,fecha,hora_utc,duracion_s,texto,enlace,vistas,alcance,me_gusta,comentarios,compartidos,guardados,seguidores_ganados,visitas_perfil,tiempo_promedio_s,tiempo_total_s,pct_completo,pct_salta_3s,ret_1s,ret_3s,ret_5s,ret_10s,pct_para_ti,pct_busqueda,pct_no_seguidores,pais_principal,sincronizado,actualizado,curva_retencion,reproducciones_con_repeticion,completos,interacciones";

  it("las celdas con error: quedan en null y van a errores", () => {
    const fila =
      'facebook,meta,1,2026-11-05,5:07,,"hola",,10,error: (#10) permiso,,,,,,,,,,,,,,,,,,,,,,,,"{""COMMENT"":2,""SHARE"":3}"';
    const [p] = leerMetricasCsv(`${cabecera}\n${fila}`, leidoEn);
    expect(p?.lectura?.cifras.alcance).toBeNull();
    expect(p?.lectura?.errores).toEqual(["alcance: error: (#10) permiso"]);
    expect(p?.lectura?.cifras).toMatchObject({ comentarios: 2, compartidos: 3, interacciones: 5 });
    expect(p?.publicacion.publicadoEn?.toISOString()).toBe("2026-11-05T05:07:00.000Z");
  });
});
