// Crea (si no existe) el usuario y una invitación de un solo uso que vale 24 h. Imprime solo el enlace y cuándo vence.
// Uso: npm run invitar -- "Andrés"
//  o:  node --conditions=react-server --import tsx scripts/invitar.ts "Andrés"   (imagen herramientas)
import { crearEnlaceDeInvitacion } from "../src/servidor/acceso/invitar";
import { cerrarBd } from "../src/servidor/db/cliente";

const nombre = process.argv.slice(2).join(" ").trim();
try {
  if (!nombre) throw new Error('Falta el nombre. Uso: npm run invitar -- "Andrés"');
  const { enlace, expiraEn } = await crearEnlaceDeInvitacion(nombre);
  console.log(enlace);
  console.log(
    `Vence: ${expiraEn.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" })} (hora de Bogotá). Se usa una sola vez.`,
  );
} catch (e) {
  console.error(`No se pudo invitar: ${e instanceof Error ? e.message : "error desconocido"}`);
  process.exitCode = 1;
} finally {
  await cerrarBd();
}
