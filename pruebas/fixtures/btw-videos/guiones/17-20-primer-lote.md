# Lote del 5-nov: ideas 4, 12, 6 y 7 de `guiones/ideas-2026-11-05.md`

Andrés pidió el 5-nov "hazlos todos". Este lote son las ideas que se pueden mostrar con las capturas reales que ya
hay (`public/app/2026-10-28/`). Las que necesitan otras pantallas (inventario, conteo físico, cartera, fidelización,
reportes y producto adicional) esperan capturas de Andrés.

Revisado en el código de BTWash (5-nov):
- **Cierre de caja** (`app/protected/historial/page.tsx`): separa efectivo, transferencia y crédito otorgado ("cuentas
  por cobrar"), con los filtros Hoy, Últimos 7 días y Este mes. La captura `05-caja.png` dice $775.000 en total,
  $320.000 en efectivo y $455.000 por transferencia.
- **Liquidación por lavador** (`04-comision.png`): Diana, 5 órdenes con placa y valor, comisión de 30 %, total a
  pagar $181.500.
- **El precio de cada servicio se puede editar en la orden** (`03-cobro.png`). Por eso ningún video promete que el
  lavador no pueda cobrar distinto.
- **Comprobante por WhatsApp** (`lib/comprobante.ts`): orden de servicio, ticket y aviso de carro listo con
  enlace `wa.me`. No es factura.
- **Reportes:** ranking de lavadores por periodo (`app/protected/reportes/page.tsx`).

## 17. "¿Cuánto tienes en la mano?" (idea 4, la cuenta, ~38 s, voz de Fernando)

| id | Voz | En pantalla |
|---|---|---|
| n1 | Hoy vendiste setecientos setenta y cinco mil. ¿Cuántos tienes en la mano? | Clip de plata contada; "$775.000" que cuenta hacia arriba |
| n2 | Abres el cajón… y hay trescientos veinte mil. | Tablero: "Esperabas $775.000" tachado; "Hay $320.000" |
| n3 | Y empieza la angustia: ¿se perdió plata? ¿Alguien se la llevó? | Clip de calculadora; preguntas grandes |
| n4 | Pero mira bien: cuatrocientos cincuenta y cinco mil entraron por transferencia. Están en el banco, no en el cajón. | Tarjetas Efectivo $320.000 + Transferencia $455.000 = $775.000 |
| n5 | Y si fiaste un lavado, esa plata tampoco está: está en la calle. | Tarjeta "Fiado: por cobrar" |
| n6 | Por eso la caja nunca te cuadra… y terminas sospechando de quien no es. | EL GIRO a color |
| n7 | En Bitiwash, el cierre te lo separa solo. Efectivo, transferencia y lo que quedó por cobrar. | Captura real del cierre, con ✓ en cada cifra al decirla |
| n8 | ¿A ti te cuadra la caja al final del día? Dime sí o no. | Caja de comentario que escribe "Casi nunca 😅" |

Puntaje: 12/12.
- **1-2:** gancho con cifra y pregunta, sin marca.
- **3:** una idea ("la caja no cuadra porque no separas los métodos de pago").
- **4:** cifra en el segundo 0.
- **5:** la brecha se cierra en n4.
- **6:** "pero" en n4 y "por eso" en n6.
- **7:** contraste entre lo que esperas y lo que hay.
- **8:** el dueño es el protagonista.
- **9:** ~107 palabras.
- **10:** escrito para el oído.
- **11:** un cambio cada 2-3 s.
- **12:** respuesta de sí o no.

## 18. "Subes el lavado a $30.000" (idea 12, mito con cuentas, ~38 s, voz de Fernando)

| id | Voz | En pantalla |
|---|---|---|
| n1 | Subes el lavado de veinticinco a treinta mil. ¿Cuántos clientes puedes perder? | Clip de espuma; "$25.000 → $30.000" |
| n2 | Hoy lavas veintiséis carros al día, a veinticinco mil: seiscientos cincuenta mil. | 26 carritos; barra de $650.000 |
| n3 | A treinta mil, con veintidós carros ya entran seiscientos sesenta mil. | 22 carritos; barra de $660.000, más larga |
| n4 | O sea: se te pueden ir cuatro carros al día… y ganas más. | 4 carritos se van en rojo; "+$10.000 al día" |
| n5 | Y con menos carros, gastas menos: jabón, agua y horas de lavadores. | Tres tarjetas "menos" |
| n6 | Pero ojo: si se te van cinco, ya entra menos plata. | EL GIRO: 21 × $30.000 = $630.000, menos que $650.000 |
| n7 | Por eso no se adivina, se mide. En Bitiwash ves cuántos carros entraron cada semana. | Captura del cierre con "Últimos 7 días" y "Servicios Totales" |
| n8 | Si subes el precio, en siete días sabes si te equivocaste. | Calendario de 7 días que se llena |
| n9 | ¿A cuánto cobras tú el lavado sencillo? Escríbelo aquí abajo. | Caja de comentario que escribe "$28.000 🚗" |

Las cuentas:
- 26 × 25.000 = 650.000.
- 22 × 30.000 = 660.000.
- 21 × 30.000 = 630.000. Con 5 carros menos ya entra menos plata, así que el punto de equilibrio está en 21,7
  carros.
- n5 no promete cifras de ahorro.

Puntaje: 12/12 (mito con dos cifras, giro y pregunta con número).

## 19. "¿Cuántos lavaste?" (idea 6, diálogo en texto, ~19 s, sin voz)

1. **Pregunta y respuesta:**
   - LAVADORA: "Jefe, la quincena me salió corta 🤔";
   - TÚ: "¿Cuántos carros lavaste?";
   - LAVADORA: "Como siete… 🤷‍♀️".
2. **YO, ABRIENDO BTWASH:** "A ver…", con la captura real de liquidación (5 órdenes con placa, comisión de
   $181.500).
3. **Marcas:** ✓ 5 CARROS CON PLACA, ✓ COMISIÓN CALCULADA y ✓ SIN DISCUTIR.
4. **Remate:** "Cuentas claras ✅". **Pregunta:** "¿Tú cómo llevas las comisiones? 👇".

Tono: la lavadora no miente, se equivoca de buena fe ("como siete"). La app no acusa: muestra.

## 20. "¿Tu talonario te cuida?" (idea 7, la cuenta, ~34 s, voz de Fernando)

| id | Voz |
|---|---|
| n1 | ¿Tu talonario te cuida… o solo se ve ordenado? |
| n2 | Cada carro tiene su papelito: placa, servicio y precio. Parece control. |
| n3 | Pero el talonario no suma. Al cierre, alguien tiene que sumar cuarenta papelitos. |
| n4 | Y si uno se moja, se pierde o nadie lo llenó… ese carro no existió. |
| n5 | Y para saber cuánto entró en efectivo y cuánto por transferencia… otra vez a sumar. |
| n6 | En Bitiwash escribes la placa, y si el cliente ya vino, sus datos se llenan solos. |
| n7 | Y al cerrar, la caja ya está sumada y separada. |
| n8 | ¿Tú todavía usas talonario? Dime sí o no. |

Puntaje: 11/12. La cifra llega en el segundo 11, no antes del 8. Capturas reales: `01-nueva-orden.png` ("Cliente
encontrado, datos llenados automáticamente") y `05-caja.png`.

## 21. "Cinco mil de diferencia" (idea 1, la cuenta, ~32 s, voz de Fernando)

| id | Voz |
|---|---|
| n1 | Tres carros al día con cinco mil pesos de diferencia… son trescientos noventa mil al mes. |
| n2 | ¿Cómo pasa? El cliente pide el completo… y en el cuaderno queda el sencillo. |
| n3 | No siempre es mala fe. Pero en el cuaderno solo queda una cifra, y nadie lo nota. |
| n4 | En Bitiwash, cada orden lleva la placa, el servicio y su precio. |
| n5 | Y le puedes mandar la orden al cliente por WhatsApp: él ve qué servicio quedó registrado. |
| n6 | Si algo no cuadra, lo ves en la orden, no a fin de mes. |
| n7 | ¿Cuál es el servicio que más te piden? Escríbelo aquí abajo. |

Cuenta: 3 × 5.000 × 26 = 390.000. Puntaje: 12/12.
- No promete que nadie pueda cobrar distinto, porque el precio se edita en la orden.
- No muestra una pantalla de WhatsApp, porque no hay captura.
- No dice que el reporte separe los servicios por tipo, porque no lo hace.

## Lo que falta de las 12 ideas

- **Idea 2 ("un carro al día sin anotar"):** no se hace. Es casi el mismo video que el 14 (en borrador para el 6-nov),
  y un video repetido compite consigo mismo. Se retoma con otro gancho si el 14 funciona.
- **Ideas 3 (balde de jabón), 5 (la semana libre), 8 (insumos), 9 (fiado), 10 (brillo de llantas) y 11 (meses
  flojos):** esperan capturas reales de Andrés:
  - inventario y conteo físico;
  - el reporte de lavadores;
  - la pestaña Insumos con costos;
  - cartera con abonos;
  - una orden con un producto adicional agregado;
  - la fidelización (sellos o puntos).
