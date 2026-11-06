// Revisión optimista: sin cookie de sesión, a /entrar. La validación real (la base) la hace exigirSesion().
import { NextResponse, type NextRequest } from "next/server";
import { decidirProxy } from "./servidor/acceso/decision-proxy";

export function proxy(req: NextRequest): NextResponse {
  const d = decidirProxy({
    ruta: req.nextUrl.pathname,
    tieneCookie: req.cookies.has("__Host-btw_sesion"),
    produccion: process.env.NODE_ENV === "production",
    origen: process.env.WEBAUTHN_ORIGEN?.trim() || undefined,
  });
  switch (d.tipo) {
    case "redirigir":
      return NextResponse.redirect(d.url);
    case "no_autorizado":
      return NextResponse.json({ error: "Se necesita iniciar sesión." }, { status: 401 });
    case "negar":
      return new NextResponse("Acceso no configurado.", { status: 503 });
    default:
      return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.[A-Za-z0-9]+$).*)"],
};
