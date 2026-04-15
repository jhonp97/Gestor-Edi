import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/trucks',
          '/transactions',
          '/workers',
          '/nomina',
          '/admin',
          '/api/',
        ],
      },
    ],
    sitemap: 'https://flota-camiones.com/sitemap.xml',
    host: 'https://flota-camiones.com',
  }
}
