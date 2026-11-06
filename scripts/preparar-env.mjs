// Agrega a .env.local las variables locales que faltan (contraseña de la base, URL y secreto del recolector),
// generadas al azar. Nunca imprime valores: solo los nombres que agregó. No toca las que ya existen.
// Uso: npm run preparar-env
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const archivo = ".env.local";
const actual = existsSync(archivo) ? readFileSync(archivo, "utf8") : "";
const tiene = (k) => new RegExp(`^\\s*${k}\\s*=\\s*\\S`, "m").test(actual);
const valorDe = (k) => actual.match(new RegExp(`^\\s*${k}\\s*=\\s*(.*)$`, "m"))?.[1]?.trim();

const nuevas = [];
const poner = (k, v) => {
  if (!tiene(k)) nuevas.push([k, v]);
};

const clave = valorDe("POSTGRES_PASSWORD") || randomBytes(24).toString("hex");
const puerto = valorDe("POSTGRES_PUERTO") || "5434";
poner("POSTGRES_PASSWORD", clave);
poner("POSTGRES_PUERTO", puerto);
poner("DATABASE_URL", `postgres://btw_dueno:${clave}@127.0.0.1:${puerto}/btw_tablero`);
poner("RECOLECTOR_SECRETO", randomBytes(32).toString("base64url"));
poner("BTW_VIDEOS_DIR", "C:/Proyectos/btw-videos");

if (nuevas.length) {
  const sep = actual.length && !actual.endsWith("\n") ? "\n" : "";
  appendFileSync(archivo, `${sep}\n# Generadas por npm run preparar-env\n${nuevas.map(([k, v]) => `${k}=${v}`).join("\n")}\n`, "utf8");
}
console.log(nuevas.length ? `Agregadas: ${nuevas.map(([k]) => k).join(", ")}` : "No faltaba nada.");
