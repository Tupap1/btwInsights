"use client";
// T25: al entrar al tablero (y al volver a la pestaña) pide una lectura nueva a Zernio y Meta (solo GET), espera a
// que termine y vuelve a pintar la página con los datos nuevos. Sin clics. Muestra cuándo fue la última lectura.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sigueEsperando, type EstadoLectura } from "./actualizar-al-entrar-logica";

interface Ultima {
  estado: "en_curso" | "ok" | "parcial" | "error" | "abandonada";
  iniciadaEn: string;
  terminadaEn: string | null;
}
type Respuesta = EstadoLectura & { ultima: Ultima | null };
type Vista = { tipo: "nada" } | { tipo: "actualizando" } | { tipo: "listo"; ultima: Ultima | null };

const CADA_MS = 3_000;
const ENTRE_INTENTOS_MS = 60_000;

const hora = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

async function consultar(): Promise<Respuesta | null> {
  try {
    const r = await fetch("/api/actualizar", { cache: "no-store" });
    return r.ok ? ((await r.json()) as Respuesta) : null;
  } catch {
    return null;
  }
}

export function ActualizarAlEntrar() {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>({ tipo: "nada" });
  const ultimoIntento = useRef(0);

  useEffect(() => {
    let vivo = true;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const esperar = (modo: "iniciada" | "en_curso", desdeMs: number, inicio: number): void => {
      temporizador = setTimeout(async () => {
        const r = await consultar();
        if (!vivo) return;
        if (r && sigueEsperando(r, modo, desdeMs, Date.now() - inicio)) {
          esperar(modo, desdeMs, inicio);
          return;
        }
        setVista({ tipo: "listo", ultima: r?.ultima ?? null });
        router.refresh();
      }, CADA_MS);
    };

    const pedir = async (): Promise<void> => {
      if (Date.now() - ultimoIntento.current < ENTRE_INTENTOS_MS) return;
      ultimoIntento.current = Date.now();
      try {
        const r = await fetch("/api/actualizar", { method: "POST", cache: "no-store" });
        if (!vivo || !r.ok) return;
        const { estado, desde } = (await r.json()) as { estado: string; desde: string };
        if (estado === "iniciada" || estado === "en_curso") {
          setVista({ tipo: "actualizando" });
          esperar(estado, Date.parse(desde), Date.now());
        } else {
          const e = await consultar();
          if (vivo) setVista({ tipo: "listo", ultima: e?.ultima ?? null });
        }
      } catch {
        // Sin red o sin sesión: la página sigue con lo que ya tiene.
      }
    };

    void pedir();
    const alVolver = () => {
      if (document.visibilityState === "visible") void pedir();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      if (temporizador) clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [router]);

  if (vista.tipo === "nada") return null;
  if (vista.tipo === "actualizando") {
    return (
      <p role="status" className="text-right text-xs text-muted-foreground">
        Actualizando con Zernio y Meta…
      </p>
    );
  }
  const u = vista.ultima;
  if (!u?.terminadaEn) return null;
  const cuando = hora.format(new Date(u.terminadaEn));
  if (u.estado === "ok") {
    return (
      <p role="status" className="text-right text-xs text-muted-foreground">
        Actualizado a las {cuando}
      </p>
    );
  }
  return (
    <p role="status" className="text-right text-xs text-muted-foreground">
      Actualizado a las {cuando} con avisos ·{" "}
      <Link href="/hoy" className="underline underline-offset-4">
        ver alertas
      </Link>
    </p>
  );
}
