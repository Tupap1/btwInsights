# Tablero BTW Insights: fases 1, 2 y 3

No fusionar todavía: Andrés lo revisa.

## Qué trae
**Fase 1 (desplegada en Docker en el servidor de BTW, proyecto `btw-insights`):**
- Importación de `btw-videos`, recolector de Zernio y Meta (solo GET) con candado, plan de lecturas y alertas.
- Pantallas Hoy, Videos, Detalle, Cola de 14 días y Sin asignar, pensadas para el celular; cada cifra con su fuente
  y su antigüedad.
- **Inicio de sesión con llave de acceso (passkey)** por invitación de un solo uso; sesión en la base (solo el
  sha256 del token); `proxy.ts` y cabeceras de seguridad.
- Roles de la base (`btw_app` sin DDL ni DELETE salvo sesiones), respaldo diario con copia al host y restauración
  probada.
- Prueba de portabilidad (base nueva → migraciones → importar → app) y búsqueda de secretos en `.next` y en la
  imagen: sin hallazgos.

**Fase 2:**
- T15: editar el texto y la fecha de los borradores de Zernio desde `/cola`, siempre con `isDraft: true` y con
  confirmación. Un único método de escritura; sin uso real todavía.
- T16: banco de ideas y guiones (`/ideas`, "Pasar a reel").
- T17 leads, T18 cuentas, T19 alertas completas, T20 aprendizajes, T21 exportación CSV para la tarea de las 8:00.

**Fase 3 y cambios del 6-nov:**
- T22: comentarios de Instagram y TikTok desde el inbox de Zernio (solo GET). De quien comenta se guardan el texto
  y el @, nunca el nombre, el id ni la foto. `/comentarios`, sección en el detalle y tarjeta "sin responder" en `/hoy`.
- T24: el tablero es para ver. "Editar borrador" (T15) queda apagado salvo `EDITAR_BORRADORES=1`.
- T25: se actualiza al entrar. Al abrir el tablero, o al volver a la pestaña, pide una lectura nueva y vuelve a pintar
  la página. Si hubo una hace menos de 2 min, no lanza otra.
- T23, pauta de Meta Ads por la API de Meta: bloqueada hasta que haya un token con `ads_read` y la cuenta
  publicitaria. Leads de BTWash: todavía no. R2: descartada.

## Pruebas
- `npm run verificar` (tsc, eslint y vitest) en verde desde un checkout limpio, en cada commit.
- `npm run build` en verde.
- Revisado en modo producción con una sesión real: todas las pantallas responden 200 sin desbordamiento a 375 y
  1440 px (`docs/capturas/`).
- Ninguna prueba llama a las APIs reales. Ninguna escritura real en Zernio ni en Meta.

## Pendiente (detalle en `TRACKER.md`, "Para Andrés al levantarse")
- Nginx Proxy Manager y el hostname del túnel para `insights.btw-one.com`.
- Registrar la llave de acceso con el enlace de invitación.
- El token de Meta con `ads_read` para la pauta (T23).
- "Decisiones por revisar".

Specs por tarea en `docs/specs/`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_0146jvUD97169Kjkr2bteVTF
