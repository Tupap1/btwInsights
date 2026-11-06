"use client";
// Botón de acceso con llave de acceso (WebAuthn): sirve para entrar y para registrar la llave con una invitación.
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/componentes/ui/button";

async function post(url: string, cuerpo: unknown): Promise<unknown> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error("fallo");
  return r.json();
}

export function AccesoLlave({ modo, token }: Readonly<{ modo: "entrar" | "registrar"; token?: string }>) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar() {
    setOcupado(true);
    setError(null);
    try {
      if (modo === "registrar") {
        const opciones = (await post("/api/acceso/registro/opciones", { t: token })) as Parameters<
          typeof startRegistration
        >[0]["optionsJSON"];
        const respuesta = await startRegistration({ optionsJSON: opciones });
        await post("/api/acceso/registro/verificar", { t: token, respuesta });
      } else {
        const opciones = (await post("/api/acceso/entrada/opciones", {})) as Parameters<
          typeof startAuthentication
        >[0]["optionsJSON"];
        const respuesta = await startAuthentication({ optionsJSON: opciones });
        await post("/api/acceso/entrada/verificar", { respuesta });
      }
      router.replace("/hoy");
      router.refresh();
    } catch {
      setError(
        modo === "registrar"
          ? "No se pudo guardar la llave de acceso. Inténtalo de nuevo o pide otra invitación."
          : "No se pudo entrar. Inténtalo de nuevo.",
      );
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" size="lg" onClick={entrar} disabled={ocupado}>
        <KeyRound aria-hidden />
        {modo === "registrar" ? "Crear llave de acceso" : "Entrar con llave de acceso"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
