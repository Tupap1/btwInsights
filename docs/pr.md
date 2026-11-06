# Tablero BTW Insights: fases 1 y 2

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

**Fase 3:** nada implementado; lo que queda necesita una decisión o un permiso de Andrés (ver `TRACKER.md`).

## Pruebas
- `npm run verificar` (tsc, eslint y vitest): 437 pruebas en 49 archivos, en verde desde un checkout limpio.
- `npm run build` en verde.
- Revisado en modo producción con una sesión real: todas las pantallas responden 200 sin desbordamiento a 375 y
  1440 px (`docs/capturas/`).
- Ninguna prueba llama a las APIs reales. Ninguna escritura real en Zernio ni en Meta.

## Pendiente (detalle en `TRACKER.md`, "Para Andrés al levantarse")
- Nginx Proxy Manager y el hostname del túnel para `insights.btw-one.com`.
- Registrar la llave de acceso con el enlace de invitación.
- Primer uso real de "Editar borrador".
- Decisiones de la fase 3 y de "Decisiones por revisar".

Specs por tarea en `docs/specs/`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_0146jvUD97169Kjkr2bteVTF
