// Sesión de quien usa el tablero. Cada página, acción del servidor y ruta privada llama a exigirSesion().
// Mientras no exista el inicio de sesión propio (T09): en desarrollo entra el usuario local y en producción NO entra
// nadie. Así, si se despliega antes de tiempo, no queda nada abierto.
import "server-only";

export interface Sesion {
  usuario: string;
}

export class SinSesion extends Error {
  constructor() {
    super("Se necesita iniciar sesión.");
    this.name = "SinSesion";
  }
}

export async function sesionActual(): Promise<Sesion | null> {
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") return { usuario: "local" };
  return null;
}

export async function exigirSesion(): Promise<Sesion> {
  const s = await sesionActual();
  if (!s) throw new SinSesion();
  return s;
}
