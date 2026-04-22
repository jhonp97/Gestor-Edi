import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify } from 'jose'
import { auth } from '@/lib/auth'
import { getJwtSecret } from '@/lib/jwt-secret'
import { Button } from '@/components/ui/button'
import {
  Truck, BarChart3, Users, Banknote, Receipt, Wifi,
  ChevronRight, Shield, TrendingUp, CheckCircle2
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Gestión de Flota de Camiones | Control de Ingresos, Gastos y Nóminas",
  description:
    "Flota Camiones es el mejor software de gestión de flota de camiones en España. Controlá ingresos, gastos, trabajadores y nóminas con IRPF y Seguridad Social. Dashboard visual, funciona offline.",
  keywords: [
    "software gestión flota camiones España",
    "control ingresos gastos camiones",
    "gestión nóminas transportistas IRPF",
    "dashboard transporte mercancías",
    "ERP trucking español",
  ],
  openGraph: {
    title: "Flota Camiones — Gestión de Flota de Camiones en España",
    description:
      "Sistema integral para transportistas españoles. Control de ingresos, gastos, trabajadores y nóminas con deducciones españolas.",
    url: "https://flota-camiones.com",
    siteName: "Flota Camiones",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Flota Camiones - Dashboard de Gestión",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Flota Camiones — Gestión de Flota de Camiones",
    description:
      "El mejor software de gestión de flota de camiones en España.",
    images: ["/og-image.png"],
  },
}

// JSON-LD Structured Data
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://flota-camiones.com/#organization',
      name: 'Flota Camiones',
      url: 'https://flota-camiones.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://flota-camiones.com/icons/icon-512.png',
      },
      description:
        'Sistema integral de gestión de flota de camiones en España. Control de ingresos, gastos, trabajadores y nóminas.',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'soporte@flotacamiones.com',
        telephone: '+34-900-123-456',
        contactType: 'customer service',
        availableLanguage: 'Spanish',
        areaServed: 'ES',
      },
      sameAs: [],
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://flota-camiones.com/#software',
      name: 'Flota Camiones',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
        description: 'Plan gratuito con funcionalidades básicas',
      },
      description:
        'Software de gestión de flota de camiones para transportistas españoles. Dashboard, control de transacciones, gestión de personal y nóminas.',
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://flota-camiones.com/#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: '¿Qué es Flota Camiones?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Flota Camiones es un software SaaS de gestión integral de flotas de camiones diseñado para transportistas y gestores de flota en España. Permite gestionar vehículos, transacciones, trabajadores y nóminas con deducciones españolas.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Cómo funciona el control de ingresos y gastos?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Cada transacción (ingreso o gasto) se registra asociada a un camión específico. El sistema categoriza automáticamente por tipo (combustible, peajes, reparaciones) y muestra visualizaciones en el dashboard con tendencias mensuales.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Flota Camiones calcula las nóminas con IRPF español?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Sí, el sistema genera nóminas con todas las deducciones españolas: IRPF según tablas de la Agencia Tributaria, Seguridad Social (cuota obrera y empresarial), y cálculo de base de cotización según salario.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Puedo usar Flota Camiones sin conexión a internet?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Sí, Flota Camiones es una PWA (Progressive Web App) que funciona offline. Se instala en tu dispositivo y sincroniza automáticamente cuando vuelves a tener conexión.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Cuáles son los planes disponibles?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Plan Gratuito: hasta 5 camiones, 10 trabajadores, 100 transacciones/mes. Plan Profesional: hasta 50 camiones, 100 trabajadores, transacciones ilimitadas. Plan Empresa: ilimitado con soporte dedicado.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Flota Camiones cumple con el RGPD?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Sí, cumple con RGPD y LOPDGDD. Incluye cifrado AES-256 para datos sensibles, derechos ARCO (Acceso, Rectificación, Supresión, Portabilidad), y gestión de cookies con consentimiento.',
          },
        },
      ],
    },
  ],
}

export default async function HomePage() {
  async function isAuthenticated(): Promise<boolean> {
    // 1. Check NextAuth session first (Google OAuth)
    try {
      const session = await auth()
      if (session?.user) return true
    } catch {
      // NextAuth not available, try custom JWT
    }

    // 2. Check custom JWT cookie (email/password login)
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return false

    try {
      const secret = new TextEncoder().encode(getJwtSecret())
      await jwtVerify(token, secret)
      return true
    } catch {
      return false
    }
  }

  // If authenticated, redirect to dashboard
  if (await isAuthenticated()) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/">
                <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e]">
                  <Truck className="size-5 text-white" />
                </div>
              </Link>
              <span className="text-xl font-bold text-[#1e3a5f]">Flota Camiones</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" className="text-[#1e3a5f]">
                  Iniciar Sesión
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white">
                  Crear Cuenta
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16">
        {/* Background with gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8e] to-[#1e3a5f]">
          {/* Animated circles */}
          <div className="absolute top-20 left-10 size-72 rounded-full bg-white/5 blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 size-96 rounded-full bg-[#4a90d9]/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-40 right-1/4 size-48 rounded-full bg-[#6bb3f0]/10 blur-2xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative container mx-auto px-4 py-24 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Text Content */}
            <div className="text-center lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
                <Shield className="size-4" />
                <span>Gestión segura y profesional</span>
              </div>
              <h1 className="mb-6 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                Controla tu flota de{' '}
                <span className="bg-gradient-to-r from-[#6bb3f0] to-[#4a90d9] bg-clip-text text-transparent">
                  camiones
                </span>{' '}
                como un profesional
              </h1>
              <p className="mb-8 text-lg text-white/80 sm:text-xl">
                Sistema integral que te permite gestionar ingresos, gastos, trabajadores y nóminas.
                Todo desde una sola plataforma, accesible desde cualquier dispositivo.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
                <Link href="/register">
                  <Button size="lg" className="w-full bg-white text-[#1e3a5f] hover:bg-gray-100 sm:w-auto text-base font-semibold">
                    Empezar Gratis
                    <ChevronRight className="ml-2 size-5" />
                  </Button>
                </Link>
                <Link href="#features">
                  <Button size="lg" variant="outline" className="w-full border-white/30 text-[#1e3a5f] hover:bg-white/10 sm:w-auto text-base">
                    Ver Funcionalidades
                  </Button>
                </Link>
              </div>
              {/* Trust badges */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-6 lg:justify-start">
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <CheckCircle2 className="size-4 text-green-400" />
                  <span>Sin costo oculto</span>
                </div>
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <CheckCircle2 className="size-4 text-green-400" />
                  <span>Funciona sin internet</span>
                </div>
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <CheckCircle2 className="size-4 text-green-400" />
                  <span>Datos seguros</span>
                </div>
              </div>
            </div>

            {/* Dashboard Preview */}
            <div className="relative">
              <div className="rounded-2xl bg-white/10 p-2 backdrop-blur-sm shadow-2xl">
                <div className="rounded-xl bg-white p-4">
                  {/* Mock Dashboard Header */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded-full bg-red-400"></div>
                      <div className="size-3 rounded-full bg-yellow-400"></div>
                      <div className="size-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="text-xs text-gray-400">Dashboard — Octubre 2026</div>
                  </div>
                  {/* Mock Cards */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg bg-green-50 p-3">
                      <div className="text-xs text-green-600 font-medium">Ingresos</div>
                      <div className="text-lg font-bold text-green-700">$12,450</div>
                    </div>
                    <div className="rounded-lg bg-red-50 p-3">
                      <div className="text-xs text-red-600 font-medium">Gastos</div>
                      <div className="text-lg font-bold text-red-700">$4,230</div>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-3">
                      <div className="text-xs text-blue-600 font-medium">Beneficio</div>
                      <div className="text-lg font-bold text-blue-700">$8,220</div>
                    </div>
                  </div>
                  {/* Mock Chart */}
                  <div className="h-24 rounded-lg bg-gradient-to-r from-[#1e3a5f]/10 to-[#4a90d9]/10 flex items-end justify-around p-2">
                    {[40, 65, 45, 80, 55, 70, 85, 60, 75, 90, 65, 50].map((h, i) => (
                      <div key={i} className="w-4 rounded-t bg-gradient-to-t from-[#1e3a5f] to-[#4a90d9]" style={{ height: `${h}%` }}></div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 rounded-xl bg-[#4a90d9] p-3 shadow-lg">
                <TrendingUp className="size-6 text-white" />
              </div>
              <div className="absolute -bottom-4 -left-4 rounded-xl bg-green-500 p-3 shadow-lg">
                <CheckCircle2 className="size-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-[#1e3a5f] sm:text-4xl">
              Todo lo que necesitas para tu flota
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              Herramientas profesionales diseñadas específicamente para transportistas y gestores de flota.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e] shadow-lg">
                <Truck className="size-7 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Gestión de Camiones</h3>
              <p className="text-gray-600 leading-relaxed">
                Registra tus camiones con matrícula, marca, modelo y estado actual.
                Controla todo tu parque vehicular desde un solo lugar.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                <Receipt className="size-7 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Control de Transacciones</h3>
              <p className="text-gray-600 leading-relaxed">
                Registra ingresos y gastos por cada camión. Categoriza automáticamente
                combustible, peajes, reparaciones y más.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4a90d9] to-[#6bb3f0] shadow-lg">
                <BarChart3 className="size-7 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Dashboard Visual</h3>
              <p className="text-gray-600 leading-relaxed">
                Visualiza tus ingresos vs gastos con gráficos interactivos.
                Analiza tendencias mensuales y categorías de gastos.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                <Users className="size-7 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Gestión de Personal</h3>
              <p className="text-gray-600 leading-relaxed">
                Administra conductores, mecánicos y personal administrativo.
                Asigna trabajadores a camiones específicos.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg">
                <Banknote className="size-7 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Nómina Automática</h3>
              <p className="text-gray-600 leading-relaxed">
                Genera nóminas con deducciones españolas: IRPF, Seguridad Social.
                Descarga recibos en PDF.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg">
                <Wifi className="size-7 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Funciona Offline</h3>
              <p className="text-gray-600 leading-relaxed">
                PWA instalable que funciona sin conexión a internet.
                Sincroniza automáticamente cuando vuelvas a conectarte.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8e]">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-white">100%</div>
              <div className="text-white/70">Funcionalidad Offline</div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-white">24/7</div>
              <div className="text-white/70">Acceso desde Cualquier Lugar</div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-white">0€</div>
              <div className="text-white/70">Costo de Implementación</div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-white">5min</div>
              <div className="text-white/70">Para Empezar a Usar</div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-[#1e3a5f] sm:text-4xl">
              Empieza en 3 simples pasos
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              Sin complicaciones, sin instalaciones complejas. En minutos estás gestionando tu flota.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="relative text-center">
              <div className="mb-6 mx-auto flex size-16 items-center justify-center rounded-full bg-[#1e3a5f] text-2xl font-bold text-white shadow-lg">
                1
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Crea tu cuenta</h3>
              <p className="text-gray-600">
                Regístrate gratis con tu email. En menos de un minuto tienes tu cuenta activa.
              </p>
              {/* Connector line */}
              <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-[#1e3a5f]/20"></div>
            </div>

            <div className="relative text-center">
              <div className="mb-6 mx-auto flex size-16 items-center justify-center rounded-full bg-[#1e3a5f] text-2xl font-bold text-white shadow-lg">
                2
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Registra tus camiones</h3>
              <p className="text-gray-600">
                Agrega tus camiones con sus datos. Asigna conductores y empieza a registrar movimientos.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6 mx-auto flex size-16 items-center justify-center rounded-full bg-[#1e3a5f] text-2xl font-bold text-white shadow-lg">
                3
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Controla todo</h3>
              <p className="text-gray-600">
                Visualiza ingresos, gastos, genera nóminas y toma decisiones basadas en datos reales.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e] p-12 shadow-2xl">
            <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
              ¿Listo para profesionalizar tu gestión?
            </h2>
            <p className="mb-8 text-lg text-white/80">
              Unite a los transportistas que ya están ahorrando tiempo y dinero con Flota Camiones.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link href="/register">
                <Button size="lg" className="w-full bg-white text-[#1e3a5f] hover:bg-gray-100 sm:w-auto text-lg font-semibold">
                  Crear Cuenta Gratis
                  <ChevronRight className="ml-2 size-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full border-white/30 text-[#1e3a5f] hover:bg-white/10 sm:w-auto text-lg">
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      </div>
  )
}
