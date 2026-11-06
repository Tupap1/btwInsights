# Fixtures con la forma de la documentación (no son respuestas reales)

El 6-nov-2026 no había ninguna campaña en Zernio (`pruebas/fixtures/api/zernio-ads*.json` son las respuestas reales,
vacías). Andrés pidió construir la pauta igual, así que estos archivos siguen los campos de la documentación de
Zernio (`GET /v1/ads/campaigns`, esquema `AdCampaign`; `GET /v1/ads`, esquema `Ad`; métricas `AdMetrics`), con
valores inventados **solo para las pruebas**.

Cuando haya pauta de verdad: `npm run grabar-fixtures:fase3`, comparar con estos archivos y ajustar el normalizador
si la forma real es distinta.

El anuncio de Instagram apunta (`creative.effectiveInstagramMediaId`) a un post real del inbox
(`18120342799999707`), para probar la unión anuncio → publicación.
