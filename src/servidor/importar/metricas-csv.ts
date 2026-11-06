// Lector del CSV de métricas del día (`metricas/AAAA-MM-DD.csv`). Función pura: recibe el contenido ya leído.
//
// Una fila = un post de una red, con la fuente de la que salió cada cifra (`zernio` o `meta`).
// - Los tiempos ya vienen en segundos y los porcentajes en 0-100: no se convierten.
// - El `texto` viene TRUNCADO a 60 caracteres en el CSV; se deja así (no es el texto completo del post).
// - Celda vacía → null. Celda que empieza con "error:" → null y se anota en `errores` de la lectura.
// - `historial.csv` no se lee: repite este mismo CSV dos veces (dos fotos del día).
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { cifrasVacias, type Cifras, type LecturaVista, type PostLeido } from "../tipos";

const celda = z.string().default("");
const esquemaFila = z.object({
  red: z.enum(["tiktok", "instagram", "facebook"]),
  fuente: z.enum(["meta", "zernio", "manual"]),
  id: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora_utc: z.string().regex(/^\d{1,2}:\d{2}$/),
  duracion_s: celda,
  texto: celda,
  enlace: celda,
  vistas: celda,
  alcance: celda,
  me_gusta: celda,
  comentarios: celda,
  compartidos: celda,
  guardados: celda,
  seguidores_ganados: celda,
  visitas_perfil: celda,
  tiempo_promedio_s: celda,
  tiempo_total_s: celda,
  pct_completo: celda,
  pct_salta_3s: celda,
  ret_1s: celda,
  ret_3s: celda,
  ret_5s: celda,
  ret_10s: celda,
  pct_para_ti: celda,
  pct_busqueda: celda,
  pct_no_seguidores: celda,
  pais_principal: celda,
  actualizado: celda,
  curva_retencion: celda,
  reproducciones_con_repeticion: celda,
  completos: celda,
  interacciones: celda,
});
type FilaCruda = z.infer<typeof esquemaFila>;

/** Columna del CSV → campo de `Cifras` (los casos especiales de `interacciones` se resuelven aparte). */
const COLUMNAS_NUMERICAS: [keyof FilaCruda, keyof Cifras][] = [
  ["vistas", "vistas"],
  ["alcance", "alcance"],
  ["me_gusta", "meGusta"],
  ["comentarios", "comentarios"],
  ["compartidos", "compartidos"],
  ["guardados", "guardados"],
  ["seguidores_ganados", "seguidoresGanados"],
  ["visitas_perfil", "visitasPerfil"],
  ["reproducciones_con_repeticion", "reproduccionesConRepeticion"],
  ["completos", "completos"],
  ["tiempo_promedio_s", "tiempoPromedioS"],
  ["tiempo_total_s", "tiempoTotalS"],
  ["pct_completo", "pctCompleto"],
  ["pct_salta_3s", "pctSalta3s"],
  ["ret_1s", "ret1s"],
  ["ret_3s", "ret3s"],
  ["ret_5s", "ret5s"],
  ["ret_10s", "ret10s"],
  ["pct_para_ti", "pctParaTi"],
  ["pct_busqueda", "pctBusqueda"],
  ["pct_no_seguidores", "pctNoSeguidores"],
];

const esquemaJsonNumeros = z.record(z.string(), z.number());

/** Redondea para quitar el ruido de coma flotante (0.61 * 100 = 61.00000000000001). */
const redondear = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * Lee un número de una celda. Vacío → null; "error: …" → null y se anota; otra cosa que no sea número → null
 * y se anota.
 */
function numero(texto: string, columna: string, errores: string[]): number | null {
  const t = texto.trim();
  if (t === "") return null;
  if (/^error:/i.test(t)) {
    errores.push(`${columna}: ${t}`);
    return null;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) {
    errores.push(`${columna}: valor no numérico "${t}"`);
    return null;
  }
  return n;
}

/** Facebook: '{"COMMENT":1,"SHARE":2}' → comentarios, compartidos e interacciones (la suma). "{}" = 0. */
function leerInteraccionesJson(
  texto: string,
  cifras: Cifras,
  reacciones: Record<string, number>,
  errores: string[],
): void {
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    errores.push("interacciones: JSON inválido");
    return;
  }
  const r = esquemaJsonNumeros.safeParse(json);
  if (!r.success) {
    errores.push("interacciones: el JSON no es un objeto de números");
    return;
  }
  const porTipo = r.data;
  cifras.interacciones = Object.values(porTipo).reduce((suma, v) => suma + v, 0);
  if (porTipo["COMMENT"] !== undefined) cifras.comentarios = porTipo["COMMENT"];
  if (porTipo["SHARE"] !== undefined) cifras.compartidos = porTipo["SHARE"];
  for (const [tipo, valor] of Object.entries(porTipo)) {
    if (tipo !== "COMMENT" && tipo !== "SHARE") reacciones[tipo] = valor;
  }
}

/** Curva de retención: JSON segundo → 0..1; sale en 0-100 y solo con los puntos que vienen. */
function leerCurva(texto: string, errores: string[]): Record<string, number> | null {
  const t = texto.trim();
  if (t === "") return null;
  if (/^error:/i.test(t)) {
    errores.push(`curva_retencion: ${t}`);
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(t);
  } catch {
    errores.push("curva_retencion: JSON inválido");
    return null;
  }
  const r = esquemaJsonNumeros.safeParse(json);
  if (!r.success) {
    errores.push("curva_retencion: el JSON no es un objeto de números");
    return null;
  }
  const salida: Record<string, number> = {};
  for (const [segundo, v] of Object.entries(r.data)) salida[segundo] = redondear(v * 100);
  return Object.keys(salida).length === 0 ? null : salida;
}

/** "CO 96.3%" → { codigo: "CO", pct: 96.3 }. */
function leerPais(texto: string, errores: string[]): { codigo: string; pct: number } | null {
  const t = texto.trim();
  if (t === "") return null;
  if (/^error:/i.test(t)) {
    errores.push(`pais_principal: ${t}`);
    return null;
  }
  const m = /^([A-Za-z]{2})\s+(\d+(?:\.\d+)?)%$/.exec(t);
  if (m?.[1] === undefined || m[2] === undefined) {
    errores.push(`pais_principal: formato no reconocido "${t}"`);
    return null;
  }
  return { codigo: m[1].toUpperCase(), pct: Number(m[2]) };
}

function leerFila(f: FilaCruda, leidoEn: Date): PostLeido {
  const errores: string[] = [];
  const cifras = cifrasVacias();
  for (const [columna, campo] of COLUMNAS_NUMERICAS) {
    cifras[campo] = numero(f[columna], columna, errores);
  }
  // TikTok devuelve alcance 0 aunque haya vistas: eso es "no dio el dato", no cero.
  if (f.red === "tiktok" && cifras.alcance === 0 && (cifras.vistas ?? 0) > 0) cifras.alcance = null;

  const reacciones: Record<string, number> = {};
  const interacciones = f.interacciones.trim();
  if (interacciones.startsWith("{")) {
    leerInteraccionesJson(interacciones, cifras, reacciones, errores);
  } else {
    cifras.interacciones = numero(interacciones, "interacciones", errores);
  }

  let datoActualizadoEn = leidoEn;
  if (f.actualizado.trim() !== "") {
    const fecha = new Date(f.actualizado);
    if (Number.isNaN(fecha.getTime())) errores.push(`actualizado: fecha inválida "${f.actualizado}"`);
    else datoActualizadoEn = fecha;
  }

  const lectura: LecturaVista = {
    fuente: f.fuente,
    via: "csv",
    datoActualizadoEn,
    cifras,
    reacciones: Object.keys(reacciones).length === 0 ? null : reacciones,
    paisPrincipal: leerPais(f.pais_principal, errores),
    curva: leerCurva(f.curva_retencion, errores),
    errores,
  };

  const duracionS = numero(f.duracion_s, "duracion_s", errores);
  const hora = f.hora_utc.padStart(5, "0");
  return {
    publicacion: {
      red: f.red,
      origen: f.fuente,
      cuenta: null,
      postIdPlataforma: f.id,
      zernioPostId: null,
      etiquetas: [],
      enlace: f.enlace.trim() === "" ? null : f.enlace,
      // Truncado a 60 caracteres en el CSV; se deja tal cual.
      texto: f.texto.trim() === "" ? null : f.texto,
      duracionS,
      programadoPara: null,
      publicadoEn: new Date(`${f.fecha}T${hora}:00Z`),
      estado: "publicado",
    },
    lectura,
  };
}

export function leerMetricasCsv(contenido: string, leidoEn: Date): PostLeido[] {
  const crudas: unknown[] = parse(contenido, { columns: true, bom: true, skip_empty_lines: true });
  return crudas.map((cruda, i) => {
    const r = esquemaFila.safeParse(cruda);
    if (!r.success) throw new Error(`CSV de métricas, fila ${i + 2}: ${r.error.message}`);
    return leerFila(r.data, leidoEn);
  });
}
