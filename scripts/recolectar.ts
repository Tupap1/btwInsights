// Corre el recolector desde la consola: npm run recolectar
import { config } from "../src/servidor/config";
import { bd, cerrarBd } from "../src/servidor/db/cliente";
import { clientes, secretos } from "../src/servidor/recolector/clientes";
import { recolectar } from "../src/servidor/recolector/recolectar";

try {
  config();
  const resumen = await recolectar(bd(), { ...clientes(), origen: "cli", secretos: secretos() });
  if (resumen.estado === "ocupado") {
    console.log("Ya hay una recolección en curso. No se hizo nada.");
    process.exitCode = 1;
  } else {
    console.log(`Recolección: ${resumen.estado}.`);
    console.log(
      `Publicaciones nuevas: ${resumen.publicacionesNuevas}. Lecturas nuevas: ${resumen.lecturasNuevas}, repetidas: ${resumen.lecturasRepetidas}.`,
    );
    console.log(`Pendientes: ${resumen.pendientes}. Alertas abiertas: ${resumen.alertasAbiertas}.`);
    for (const e of resumen.errores) console.log(`- ${e}`);
    process.exitCode = resumen.estado === "error" ? 1 : 0;
  }
} catch (e) {
  // El mensaje de la configuración nombra variables, nunca valores.
  console.error(`No se pudo recolectar: ${e instanceof Error ? e.message : "error desconocido"}`);
  process.exitCode = 1;
} finally {
  await cerrarBd();
}
