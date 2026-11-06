# Piloto de terror "Elige con quién pasas el día en tu lavadero" (29-oct)

- **Estado:** piloto hecho en segundo plano, falta que Andrés lo vea. No está en `publicar/`.
- **Idea** (plan de redes, sección "Versión de terror"): los monstruos son los problemas del dueño. El remate es
  la tablet que estuvo prendida en un rincón de cada escena, con la app real.
- **Composición:** `EligeUnoTerror01` (`src/reels/elige-uno/EligeUnoTerror.tsx`), 1080×1920, 30 fps, ~35 s.
- **Personajes:**
  - una sola imagen de Higgsfield (GPT Image 2.5, 4K media, 1,25 créditos), recortada en 4 (`public/terror/`);
  - el fondo del lavadero vacío costó 1 crédito;
  - son de arcilla, sin boca y sin parecido con personas reales, con el rótulo "Personajes IA".
- **Voces:**
  - diseñadas en ElevenLabs: "BTW Terror - Narradora" (`Z2kxfOmg355uCvGegA8w`) y "BTW Terror - Grave"
    (`Bk2mRBPIVNz7m1wzhsKZ`), con `eleven_v4`;
  - dos tomas cortadas por línea con `scripts/terror_audio.py`, que también hace los efectos `public/sfx/terror/`.

| Escena | Voz | Pantalla | Sonido |
|---|---|---|---|
| Gancho | "Elige uno… Al final te digo qué te pasa." | Los 4 en cuadrícula con números; la luz pasa por cada uno. "Elige con quién pasas el día en tu lavadero" | parpadeo |
| 1 | "Yo lo anoto todo… hasta que llueve." | La Señora del Cuaderno; corte al cuaderno con lluvia | golpe, lluvia |
| 2 | "Lavé doce carros… Tú anotaste ocho." | El Lavador de los Doce, con espuma; corte a los ojos | golpe |
| 3 | "Te pago mañana… como ayer." | El Cliente de Mañana; corte a la billetera vacía | golpe |
| 4 | "Cuéntame otra vez… siempre falta algo." | La Caja de las Nueve; corte a las monedas | golpe, monedas |
| 9 p.m. | "Son las nueve de la noche." | Lavadero vacío, "9:00 p.m.", "Lo que te pasó:" y la tablet en el mostrador | reloj |
| Resultados | "Uno: la lluvia borró el día." / "Dos: le pagaste de más." / "Tres: nunca te pagó." / "Cuatro: la caja no cuadró. Otra vez." | Número grande y primer plano de cada uno | whooshes, monedas, papel, impacto |
| Giro | "¿Y la tablet del rincón? Esa guarda todo." | Se apaga la luz y la cámara va a la tablet, que se prende | riser, encendido |
| App real | "Sin internet. La comisión, sola. El fiado, anotado. Y la caja, sumada." | `06-sin-conexion` (Desconectado), `04-comision` (Calcular liquidación), `03-cobro` (botón Crédito resaltado, sin tocarlo) y `05-caja` (totales) | desconexión, toque, monedas, pop, caja |
| Llamado | "Comenta tu número." | Los 4 otra vez, "Comenta tu número" y BTWash | golpe |

- **Comentario fijado:** "Si tienes lavadero, comenta LAVADO y te muestro cómo quedaría en el tuyo".
- **Al publicar:** etiqueta de IA (TikTok y "Add AI label" en Meta), porque hay personajes y voces de IA.
