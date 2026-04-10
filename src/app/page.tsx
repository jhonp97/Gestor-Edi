import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify } from 'jose'
import { Button } from '@/components/ui/button'
import {
  Truck, BarChart3, Users, Banknote, Receipt, Wifi,
  ChevronRight, Shield, TrendingUp, CheckCircle2,
  Mail, Phone, MapPin
} from 'lucide-react'

async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return false

  try {
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production'
    )
    await jwtVerify(token, secret)
    return true
  } catch {
    return false
  }
}

export default async function HomePage() {
  // If authenticated, redirect to dashboard
  if (await isAuthenticated()) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white">
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
                Controlá tu flota de{' '}
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
              Todo lo que necesitás para tu flota
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
                Registrá tus camiones con matrícula, marca, modelo y estado actual.
                Controlá todo tu parque vehicular desde un solo lugar.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                <Receipt className="size-7 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Control de Transacciones</h3>
              <p className="text-gray-600 leading-relaxed">
                Registrá ingresos y gastos por cada camión. Categorizá automáticamente
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
                Visualizá tus ingresos vs gastos con gráficos interactivos.
                Analizá tendencias mensuales y categorías de gastos.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                <Users className="size-7 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Gestión de Personal</h3>
              <p className="text-gray-600 leading-relaxed">
                Administrá conductores, mecánicos y personal administrativo.
                Asigná trabajadores a camiones específicos.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg">
                <Banknote className="size-7 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Nómina Automática</h3>
              <p className="text-gray-600 leading-relaxed">
                Generá nóminas con deducciones españolas: IRPF, Seguridad Social.
                Descargá recibos en PDF.
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
              Empezá en 3 simples pasos
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
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Creá tu cuenta</h3>
              <p className="text-gray-600">
                Registrate gratis con tu email. En menos de un minuto tenés tu cuenta activa.
              </p>
              {/* Connector line */}
              <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-[#1e3a5f]/20"></div>
            </div>

            <div className="relative text-center">
              <div className="mb-6 mx-auto flex size-16 items-center justify-center rounded-full bg-[#1e3a5f] text-2xl font-bold text-white shadow-lg">
                2
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Registrá tus camiones</h3>
              <p className="text-gray-600">
                Agregá tus camiones con sus datos. Asigná conductores y empezá a registrar movimientos.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6 mx-auto flex size-16 items-center justify-center rounded-full bg-[#1e3a5f] text-2xl font-bold text-white shadow-lg">
                3
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#1e3a5f]">Controlá todo</h3>
              <p className="text-gray-600">
                Visualizá ingresos, gastos, generá nóminas y tomá decisiones basadas en datos reales.
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

      {/* Footer */}
      <footer className="bg-[#0f1f33] text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="grid gap-12 md:grid-cols-4">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#4a90d9]">
                  <Truck className="size-6 text-white" />
                </div>
                <span className="text-2xl font-bold">Flota Camiones</span>
              </div>
              <p className="mb-6 max-w-md text-gray-400 leading-relaxed">
                Sistema integral de gestión diseñado específicamente para transportistas
                y gestores de flota de camiones. Simple, seguro y eficiente.
              </p>
              <div className="flex gap-4">
                <a href="#" className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                  <Mail className="size-5" />
                </a>
                <a href="#" className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                  <Phone className="size-5" />
                </a>
              </div>
            </div>

            {/* Contacto */}
            <div>
              <h4 className="mb-6 text-lg font-semibold">Contacto</h4>
              <ul className="space-y-4 text-gray-400">
                <li className="flex items-start gap-3">
                  <Mail className="mt-1 size-4 shrink-0 text-[#4a90d9]" />
                  <span>soporte@flotacamiones.com</span>
                </li>
                <li className="flex items-start gap-3">
                  <Phone className="mt-1 size-4 shrink-0 text-[#4a90d9]" />
                  <span>+34 900 123 456</span>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="mt-1 size-4 shrink-0 text-[#4a90d9]" />
                  <span>Madrid, España</span>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="mb-6 text-lg font-semibold">Legal</h4>
              <ul className="space-y-3 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Política de Privacidad
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Términos de Servicio
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Política de Cookies
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    RGPD
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 border-t border-white/10 pt-8">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <p className="text-sm text-gray-500">
                © 2026 Flota Camiones. Todos los derechos reservados.
              </p>
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <a href="#" className="hover:text-white transition-colors">Privacidad</a>
                <a href="#" className="hover:text-white transition-colors">Términos</a>
                <a href="#" className="hover:text-white transition-colors">Cookies</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
