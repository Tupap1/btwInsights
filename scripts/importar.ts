// Pasa a la base todo lo de btw-videos. Uso: npm run importar (lee BTW_VIDEOS_DIR de .env.local).
// Se puede repetir sin duplicar. No imprime URLs ni llaves.
import { bd, cerrarBd } from "../src/servidor/db/cliente";
import { importar } from "../src/servidor/importar/a-la-base";

const dir = process.env.BTW_VIDEOS_DIR?.trim();
if (!dir) {
  console.error("Falta BTW_VIDEOS_DIR: pon en .env.local la carpeta de btw-videos.");
  process.exit(1);
}

try {
  const i = await importar(bd(), dir);
  console.log(`Reels: ${i.reelsCreados} creados, ${i.reelsActualizados} actualizados.`);
  console.log(`Publicaciones: ${i.publicacionesNuevas} nuevas, ${i.publicacionesActualizadas} actualizadas.`);
  console.log(`Lecturas: ${i.lecturasNuevas} nuevas, ${i.lecturasRepetidas} repetidas.`);
  console.log(`Emparejadas por regla (fecha y texto): ${i.emparejadosPorRegla}.`);
  console.log(`Ideas: ${i.ideasNuevas} nuevas, ${i.ideasYaEstaban} que ya estaban.`);
  console.log(`Guiones: ${i.guionesPuestos} puestos, ${i.guionesYaTenian} reels que ya tenían guion.`);
  console.log(`Sin asignar: ${i.sinAsignar.length}.`);
  for (const s of i.sinAsignar) console.log(`  - ${s.red}, ${s.fecha ?? "sin fecha"}: ${s.texto}`);
  if (i.avisos.length) {
    console.log(`Avisos (${i.avisos.length}):`);
    for (const a of i.avisos) console.log(`  - ${a}`);
  }
} finally {
  await cerrarBd();
}
