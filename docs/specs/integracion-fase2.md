# Integración de la fase 2 (Opus)

## Qué se hace
- **Navegación:** en el celular y hasta `lg`, Hoy, Videos, Cola y "Más" (`/mas`: Sin asignar, Ideas, Leads,
  Cuentas, Aprendizajes y Salir); desde `lg`, todas en la barra con Salir a la derecha. La lista vive en
  `src/componentes/enlaces.ts`.
- **`/hoy`:** las alertas se separan con `separarAlertas()`: urgentes primero (errores arriba) y los avisos de
  calendario (`cola:<día>:<red>:sin-video` y `:doble`, de T19) plegados en "Avisos de calendario (N)".
- **`/cola`:** la nota "IA sin etiqueta: pendiente" pasa a decir que esas alertas salen en Hoy (T19 ya guarda la
  marca de IA).

## Criterios de aceptación
1. Prueba de `separarAlertas` (rojo primero).
2. `npm run verificar` y `npm run build` en verde.
3. En modo producción con una sesión real, `/hoy`, `/cola`, `/ideas`, `/leads`, `/cuentas`, `/aprendizajes` y
   `/mas` responden 200 sin desbordamiento a 375 y 1440 px (capturas en `docs/capturas/`).

## Fuera
Rediseñar pantallas.
