import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://flota-camiones.com',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1.0,
    },
    {
      url: 'https://flota-camiones.com/privacy',
      lastModified: new Date('2026-04-13'),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: 'https://flota-camiones.com/terms',
      lastModified: new Date('2026-04-13'),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: 'https://flota-camiones.com/legal-notice',
      lastModified: new Date('2026-04-13'),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: 'https://flota-camiones.com/login',
      lastModified: new Date(),
      changeFrequency: 'never',
      priority: 0.3,
    },
    {
      url: 'https://flota-camiones.com/register',
      lastModified: new Date(),
      changeFrequency: 'never',
      priority: 0.3,
    },
  ]
}
