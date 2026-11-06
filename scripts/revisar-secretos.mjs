// Busca los VALORES de las llaves y secretos (los de un archivo de entorno) dentro de .next/ y, si se pide,
// dentro del sistema de archivos de la imagen Docker. Nunca imprime un valor: solo "VARIABLE en ruta".
// Uso: node scripts/revisar-secretos.mjs --env <archivo .env> [--dir .next] [--imagen <nombre-de-imagen>]
// Sale con código 1 si encuentra algo o si falta --env o el archivo; 0 si no.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const VARIABLES = [
  "META_PAGE_TOKEN",
  "ZERNIO_API_KEY",
  "RECOLECTOR_SECRETO",
  "POSTGRES_PASSWORD",
  "POSTGRES_APP_PASSWORD",
  "POSTGRES_LECTURA_PASSWORD",
  "DATABASE_URL",
];
const MINIMO = 8;

/**
 * Toma los valores de las variables listadas que midan al menos 8 caracteres.
 * De DATABASE_URL toma solo la contraseña. Devuelve { VARIABLE: valor }.
 * @param {string} textoEnv contenido de un archivo .env
 * @returns {Record<string, string>}
 */
export function leerValores(textoEnv) {
  /** @type {Record<string, string>} */
  const valores = {};
  for (const linea of textoEnv.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || !VARIABLES.includes(m[1] ?? "")) continue;
    const variable = m[1] ?? "";
    let valor = quitarComillas(m[2] ?? "");
    if (variable === "DATABASE_URL") {
      valor = /^[^:/\s]+:\/\/[^:/@\s]*:([^@]*)@/.exec(valor)?.[1] ?? "";
    }
    if (valor.length >= MINIMO) valores[variable] = valor;
  }
  return valores;
}

/** Quita comillas dobles o simples que envuelvan el valor completo. */
function quitarComillas(valor) {
  const c = valor.at(0);
  if ((c === '"' || c === "'") && valor.length >= 2 && valor.at(-1) === c) return valor.slice(1, -1);
  return valor;
}

/**
 * Recorre `dir` y devuelve [{ variable, archivo }] por cada valor que aparezca como bytes en un archivo.
 * `omitir` son nombres de carpetas directamente bajo `dir` que no se revisan. Los enlaces simbólicos se saltan.
 * @param {string} dir
 * @param {Record<string, string>} valores
 * @param {string[]} [omitir]
 * @returns {{ variable: string, archivo: string }[]}
 */
export function buscarEn(dir, valores, omitir = ["cache", "dev"]) {
  const raiz = resolve(dir);
  const pendientes = Object.entries(valores).map(([variable, valor]) => ({
    variable,
    buffer: Buffer.from(valor, "utf8"),
  }));
  /** @type {{ variable: string, archivo: string }[]} */
  const hallazgos = [];
  for (const archivo of listarArchivos(raiz, omitir)) {
    const contenido = readFileSync(join(raiz, archivo));
    for (const { variable, buffer } of pendientes) {
      if (contenido.includes(buffer)) hallazgos.push({ variable, archivo });
    }
  }
  return hallazgos;
}

/** Lista rutas relativas (con "/") de los archivos regulares bajo `raiz`, sin entrar en `omitir` de primer nivel. */
function listarArchivos(raiz, omitir) {
  /** @type {string[]} */
  const archivos = [];
  const recorrer = (actual) => {
    for (const entrada of readdirSync(actual, { withFileTypes: true })) {
      const ruta = join(actual, entrada.name);
      const rel = relative(raiz, ruta);
      if (actual === raiz && omitir.includes(entrada.name)) continue;
      if (entrada.isSymbolicLink()) continue;
      if (entrada.isDirectory()) recorrer(ruta);
      else if (entrada.isFile()) archivos.push(rel.split(sep).join("/"));
    }
  };
  recorrer(raiz);
  return archivos;
}

/**
 * Exporta el sistema de archivos de una imagen a un directorio temporal (docker create + docker export | tar).
 * Devuelve la ruta del temporal; el llamador lo borra.
 * @param {string} imagen
 * @returns {string}
 */
function exportarImagen(imagen) {
  const creado = spawnSync("docker", ["create", imagen], { encoding: "utf8" });
  if (creado.status !== 0) throw new Error(`docker create falló para la imagen ${imagen}`);
  const id = creado.stdout.trim();
  const tmp = mkdtempSync(join(tmpdir(), "revisar-secretos-imagen-"));
  try {
    const exporta = spawnSync(
      "bash",
      [
        "-o",
        "pipefail",
        "-c",
        'docker export "$1" | tar -x --anchored --exclude=dev --exclude=proc --exclude=sys -C "$2"',
        "bash",
        id,
        tmp,
      ],
      { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" },
    );
    if (exporta.status !== 0) throw new Error(`no se pudo exportar la imagen ${imagen}`);
  } catch (error) {
    rmSync(tmp, { recursive: true, force: true });
    throw error;
  } finally {
    spawnSync("docker", ["rm", id], { stdio: "ignore" });
  }
  return tmp;
}

/** Lee --clave valor de argv. */
function leerArgs(argv) {
  /** @type {Record<string, string>} */
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const clave = argv[i] ?? "";
    if (!clave.startsWith("--")) continue;
    args[clave.slice(2)] = argv[i + 1] ?? "";
    i++;
  }
  return args;
}

async function main(argv) {
  const args = leerArgs(argv);
  if (!args.env) {
    console.error("Falta --env <archivo .env>.");
    return 1;
  }
  let textoEnv;
  try {
    textoEnv = readFileSync(args.env, "utf8");
  } catch {
    console.error(`No se pudo leer el archivo de entorno ${args.env}.`);
    return 1;
  }
  const valores = leerValores(textoEnv);
  console.log(`Valores a revisar: ${Object.keys(valores).length} (${Object.keys(valores).join(", ") || "ninguno"}).`);

  const dir = args.dir ?? ".next";
  const hallazgos = buscarEn(dir, valores, ["cache", "dev"]);
  const etiquetas = [dir];

  if (args.imagen) {
    const tmp = exportarImagen(args.imagen);
    try {
      hallazgos.push(...buscarEn(tmp, valores, ["proc", "sys", "dev"]));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
    etiquetas.push(`imagen ${args.imagen}`);
  }

  for (const { variable, archivo } of hallazgos) console.log(`${variable} en ${archivo}`);
  if (hallazgos.length) {
    console.log(`${hallazgos.length} hallazgo${hallazgos.length === 1 ? "" : "s"}`);
    return 1;
  }
  console.log(`Sin secretos en ${etiquetas.join(" y ")}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Error desconocido.");
    process.exitCode = 1;
  }
}
