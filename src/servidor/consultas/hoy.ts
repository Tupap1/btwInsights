// Pantalla /hoy: la semana contra la anterior por red, lo que sale hoy y mañana, alertas, mejor video y última lectura.
import "server-only";
import { and, desc, inArray, isNull } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { alerta, corrida, cuentaLectura } from "../db/esquema";
import type { Red } from "../tipos";
import {
  OBJETIVO_ULTIMA,
  cifrasDePublicacion,
  fuenteQueManda,
  sinDato,
  type Cifra,
  type LecturaDato,
} from "./cifras";
import {
  cargarDatos,
  publicadasDeRed,
  REDES,
  type PublicacionFila,
  type PublicacionSalida,
} from "./datos";
import { cargarLeadsFila, cifrasDeLeads } from "./leads";
import { HORA_MS, diaBogota, inicioDiaBogota, sumarDias } from "./tiempo";

/** Una cifra de la semana y la de la semana anterior. */
export interface Comparada {
  actual: Cifra;
  anterior: Cifra;
}

export interface TarjetaRed {
  red: Red;
  vistasGanadas: Comparada;
  tiempoPromedioPct: Comparada;
  pctPasa3s: Comparada;
  guardadosCompartidos: Comparada;
  seguidoresNuevos: Comparada;
  /** Publicaciones que salieron en la semana. */
  publicacionesSemana: number;
}

export interface SalidaDelDia {
  clave: string;
  reelId: string | null;
  gancho: string | null;
  avisos: string[];
  dia: "hoy" | "mañana";
  primeraHora: Date;
  redes: { red: Red; estado: PublicacionFila["estado"]; programadoPara: Date }[];
}

export interface MejorVideo {
  reelId: string | null;
  gancho: string | null;
  red: Red;
  publicadoEn: Date;
  vistas: Cifra;
  tiempoPromedioS: Cifra;
  pctPasa3s: Cifra;
  guardados: Cifra;
  compartidos: Cifra;
}

export interface Hoy {
  ahora: Date;
  semana: { desde: Date; hasta: Date; anteriorDesde: Date };
  tarjetas: TarjetaRed[];
  /** Leads registrados a mano: semana (lunes a domingo) contra la anterior. Los leads no son de una red. */
  leads: Comparada;
  salidas: SalidaDelDia[];
  alertas: { id: number; nivel: "info" | "aviso" | "error"; mensaje: string; creadaEn: Date }[];
  mejor: MejorVideo | null;
  ultimaLectura: Date | null;
}

// ---------- Funciones puras (con pruebas) ----------

/** Junta cifras: suma o promedio de las que tienen valor. Fuente: la común (o la primera que no sea manual). */
export function agregar(cifras: readonly Cifra[], modo: "suma" | "promedio"): Cifra {
  const con = cifras.filter((c): c is Cifra & { valor: number } => c.valor !== null);
  if (con.length === 0) return sinDato;
  const suma = con.reduce((a, c) => a + c.valor, 0);
  const fuentes = [...new Set(con.map((c) => c.fuente))];
  const fuente = fuentes.length === 1 ? (fuentes[0] ?? null) : (fuentes.find((f) => f !== "manual") ?? "manual");
  const fechas = con.flatMap((c) => (c.datoActualizadoEn ? [c.datoActualizadoEn.getTime()] : []));
  return {
    valor: modo === "suma" ? suma : suma / con.length,
    fuente,
    datoActualizadoEn: fechas.length ? new Date(Math.min(...fechas)) : null,
  };
}

/** Cambio porcentual contra el periodo anterior; null si no hay con qué comparar. */
export function variacion(actual: number | null, anterior: number | null): number | null {
  if (actual === null || anterior === null || anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

/**
 * Vistas en un instante: la última lectura vigente en ese momento. Antes de publicarse son 0 (es un hecho, no un
 * relleno); si ya estaba publicada y no hay lectura anterior, no se sabe (null).
 */
export function vistasEn(lecturas: readonly LecturaDato[], publicadoEn: Date, instante: Date): number | null {
  if (instante.getTime() < publicadoEn.getTime()) return 0;
  let mejor: LecturaDato | null = null;
  for (const l of lecturas) {
    if (l.vistas === null) continue;
    if (l.datoActualizadoEn.getTime() > instante.getTime()) continue;
    if (mejor === null || l.datoActualizadoEn.getTime() > mejor.datoActualizadoEn.getTime()) mejor = l;
  }
  return mejor ? mejor.vistas : null;
}

// ---------- Consulta ----------

export async function consultarHoy(db: BaseDeDatos, ahora: Date): Promise<Hoy> {
  const [datos, alertas, corridas, cuentas, leadsFilas] = await Promise.all([
    cargarDatos(db),
    db
      .select()
      .from(alerta)
      .where(isNull(alerta.resueltaEn))
      .orderBy(desc(alerta.creadaEn)),
    db
      .select()
      .from(corrida)
      .where(and(inArray(corrida.estado, ["ok", "parcial"])))
      .orderBy(desc(corrida.iniciadaEn))
      .limit(1),
    db.select().from(cuentaLectura),
    cargarLeadsFila(db),
  ]);

  const hoy = diaBogota(ahora);
  const desde = inicioDiaBogota(sumarDias(hoy, -6));
  const anteriorDesde = inicioDiaBogota(sumarDias(hoy, -13));

  const reelDe = (id: string | null) => (id === null ? undefined : datos.reels.find((r) => r.id === id));
  const lecturasDe = (id: number): LecturaDato[] => datos.lecturasPorPublicacion.get(id) ?? [];
  const duracionDe = (p: PublicacionFila): number | null => p.duracionS ?? reelDe(p.reelId)?.duracionS ?? null;

  const tarjetas: TarjetaRed[] = REDES.map((red) => {
    const fuente = fuenteQueManda(red);
    const publicadas = publicadasDeRed(datos.publicaciones, red);

    const ganadas = (a: Date, b: Date): Cifra => {
      const items: Cifra[] = [];
      for (const p of publicadas) {
        if (p.publicadoEn.getTime() >= b.getTime()) continue;
        const propias = lecturasDe(p.id).filter((l) => l.fuente === fuente);
        const fin = vistasEn(propias, p.publicadoEn, b);
        const inicio = vistasEn(propias, p.publicadoEn, a);
        if (fin === null || inicio === null) continue;
        const ultima = propias
          .filter((l) => l.vistas !== null && l.datoActualizadoEn.getTime() <= b.getTime())
          .reduce<Date | null>((m, l) => (m === null || l.datoActualizadoEn > m ? l.datoActualizadoEn : m), null);
        items.push({ valor: fin - inicio, fuente, datoActualizadoEn: ultima });
      }
      return agregar(items, "suma");
    };

    const delPeriodo = (a: Date, b: Date) =>
      publicadas
        .filter((p) => p.publicadoEn >= a && p.publicadoEn < b)
        .map((p) => ({ p, c: cifrasDePublicacion(red, lecturasDe(p.id), OBJETIVO_ULTIMA) }));

    const tiempoPct = (a: Date, b: Date): Cifra =>
      agregar(
        delPeriodo(a, b).map(({ p, c }) => {
          const dur = duracionDe(p);
          const t = c.tiempoPromedioS;
          return dur && dur > 0 && t.valor !== null ? { ...t, valor: (t.valor / dur) * 100 } : sinDato;
        }),
        "promedio",
      );
    const pasa3 = (a: Date, b: Date): Cifra => agregar(delPeriodo(a, b).map(({ c }) => c.pctPasa3s), "promedio");
    const guardComp = (a: Date, b: Date): Cifra =>
      agregar(
        delPeriodo(a, b).map(({ c }) => {
          const g = c.guardados;
          const s = c.compartidos;
          if (g.valor === null && s.valor === null) return sinDato;
          const base = g.valor !== null ? g : s;
          return { ...base, valor: (g.valor ?? 0) + (s.valor ?? 0) };
        }),
        "suma",
      );

    const seguidores = (a: Date, b: Date): Cifra => {
      const filas = cuentas.filter((c) => c.red === red && c.fuente === fuente && c.seguidores !== null);
      const ultima = filas.reduce<(typeof filas)[number] | null>((m, f) => (m === null || f.leidoEn > m.leidoEn ? f : m), null);
      if (!ultima) return sinDato;
      const deLaCuenta = filas.filter((f) => f.cuenta === ultima.cuenta);
      const en = (t: Date) =>
        deLaCuenta
          .filter((f) => f.leidoEn <= t)
          .reduce<(typeof filas)[number] | null>((m, f) => (m === null || f.leidoEn > m.leidoEn ? f : m), null);
      const fin = en(b);
      const ini = en(a);
      if (!fin || !ini || fin.seguidores === null || ini.seguidores === null) return sinDato;
      return { valor: fin.seguidores - ini.seguidores, fuente, datoActualizadoEn: fin.leidoEn };
    };

    return {
      red,
      vistasGanadas: { actual: ganadas(desde, ahora), anterior: ganadas(anteriorDesde, desde) },
      tiempoPromedioPct: { actual: tiempoPct(desde, ahora), anterior: tiempoPct(anteriorDesde, desde) },
      pctPasa3s: { actual: pasa3(desde, ahora), anterior: pasa3(anteriorDesde, desde) },
      guardadosCompartidos: { actual: guardComp(desde, ahora), anterior: guardComp(anteriorDesde, desde) },
      seguidoresNuevos: { actual: seguidores(desde, ahora), anterior: seguidores(anteriorDesde, desde) },
      publicacionesSemana: delPeriodo(desde, ahora).length,
    };
  });

  // Qué sale hoy y mañana.
  const inicioHoy = inicioDiaBogota(hoy);
  const finManana = inicioDiaBogota(sumarDias(hoy, 2));
  const inicioManana = inicioDiaBogota(sumarDias(hoy, 1));
  const grupos = new Map<string, SalidaDelDia>();
  const programadas = datos.publicaciones
    .filter(
      (p): p is PublicacionFila & { programadoPara: Date } =>
        p.programadoPara !== null &&
        p.programadoPara >= inicioHoy &&
        p.programadoPara < finManana &&
        p.estado !== "cancelado" &&
        p.estado !== "borrado",
    )
    .sort((a, b) => a.programadoPara.getTime() - b.programadoPara.getTime());
  for (const p of programadas) {
    const clave = p.reelId ?? `pub-${p.id}`;
    const r = reelDe(p.reelId);
    const existente = grupos.get(clave);
    const item = { red: p.red, estado: p.estado, programadoPara: p.programadoPara };
    if (existente) {
      existente.redes.push(item);
    } else {
      grupos.set(clave, {
        clave,
        reelId: p.reelId,
        gancho: r?.gancho ?? r?.textoTiktok?.slice(0, 80) ?? (p.texto ? p.texto.slice(0, 80) : null),
        avisos: r?.avisos ?? [],
        dia: p.programadoPara < inicioManana ? "hoy" : "mañana",
        primeraHora: p.programadoPara,
        redes: [item],
      });
    }
  }
  const salidas = [...grupos.values()];

  // Mejor video de los últimos 7 días: la publicación con más vistas (en su red) entre las que salieron en la semana.
  let mejor: MejorVideo | null = null;
  let mejorVistas = -1;
  for (const red of REDES) {
    for (const p of publicadasDeRed(datos.publicaciones, red) as PublicacionSalida[]) {
      if (p.publicadoEn < desde || p.publicadoEn > ahora) continue;
      const c = cifrasDePublicacion(red, lecturasDe(p.id), OBJETIVO_ULTIMA);
      if (c.vistas.valor !== null && c.vistas.valor > mejorVistas) {
        mejorVistas = c.vistas.valor;
        mejor = {
          reelId: p.reelId,
          gancho: reelDe(p.reelId)?.gancho ?? null,
          red,
          publicadoEn: p.publicadoEn,
          vistas: c.vistas,
          tiempoPromedioS: c.tiempoPromedioS,
          pctPasa3s: c.pctPasa3s,
          guardados: c.guardados,
          compartidos: c.compartidos,
        };
      }
    }
  }

  const ultima = corridas[0];
  return {
    ahora,
    semana: { desde, hasta: ahora, anteriorDesde },
    tarjetas,
    leads: cifrasDeLeads(leadsFilas, ahora),
    salidas,
    alertas: alertas.map((a) => ({ id: a.id, nivel: a.nivel, mensaje: a.mensaje, creadaEn: a.creadaEn })),
    mejor,
    ultimaLectura: ultima ? (ultima.terminadaEn ?? ultima.iniciadaEn) : null,
  };
}

/** Pasaron más de 24 h desde la última lectura buena (o nunca hubo una). */
export function lecturaVencida(ultima: Date | null, ahora: Date): boolean {
  return ultima === null || ahora.getTime() - ultima.getTime() > 24 * HORA_MS;
}
