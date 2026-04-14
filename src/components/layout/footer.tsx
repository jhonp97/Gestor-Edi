import Link from 'next/link'
import { Truck, Mail, Phone, MapPin } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-[#0f1f33] text-white" role="contentinfo">
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
            <p className="mb-6 max-w-md leading-relaxed text-gray-400">
              Sistema integral de gestión diseñado específicamente para transportistas
              y gestores de flota de camiones. Simple, seguro y eficiente.
            </p>
            <div className="flex gap-4">
              <a href="mailto:soporte@flotacamiones.com" className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20" aria-label="Email">
                <Mail className="size-5" />
              </a>
              <a href="tel:+34900123456" className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20" aria-label="Teléfono">
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
          <nav aria-label="Enlaces legales">
            <h4 className="mb-6 text-lg font-semibold">Legal</h4>
            <ul className="space-y-3 text-gray-400">
              <li>
                <Link href="/privacy" className="transition-colors hover:text-white">
                  Política de Privacidad
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-white">
                  Términos y Condiciones
                </Link>
              </li>
              <li>
                <Link href="/legal-notice" className="transition-colors hover:text-white">
                  Aviso Legal
                </Link>
              </li>
              <li>
                <Link href="/privacy#cookies" className="transition-colors hover:text-white">
                  Política de Cookies
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-gray-500">
              © {currentYear} Flota Camiones. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/privacy" className="transition-colors hover:text-white">
                Privacidad
              </Link>
              <Link href="/terms" className="transition-colors hover:text-white">
                Términos
              </Link>
              <Link href="/privacy#cookies" className="transition-colors hover:text-white">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}