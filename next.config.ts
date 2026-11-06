import type { NextConfig } from "next";

// Sin cacheComponents: el tablero exige sesión en cada página, así que todo es dinámico y el modelo clásico es más
// simple. "standalone" deja una salida mínima para la imagen de Docker.
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
