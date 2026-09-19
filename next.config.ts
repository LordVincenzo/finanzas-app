import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Los equipos de la red local que pueden pedirle recursos al servidor
   * de desarrollo.
   *
   * Next lo bloquea por defecto, y con razón: en desarrollo sirve código
   * sin minimizar y rutas internas que no conviene exponer. Pero eso
   * impide abrir la app desde el celular por la IP del PC, que es justo
   * como se prueba la PWA y como MacroDroid manda las notificaciones a
   * /api/ingesta mientras no haya despliegue.
   *
   * Solo afecta a `next dev`. En producción esta opción no hace nada.
   */
  allowedDevOrigins: ['192.168.1.19'],
};

export default nextConfig;
