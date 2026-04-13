'use client'

import Link from 'next/link'
import { Truck } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className="border-t border-border bg-card"
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <Truck className="size-5 text-primary" aria-hidden="true" />
              <span className="font-semibold text-foreground">Flota Camiones</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Gestión inteligente de flota de camiones. Todo bajo control, desde cualquier lugar.
            </p>
          </div>

          {/* Legal links */}
          <nav aria-label="Enlaces legales">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Política de Privacidad
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Términos y Condiciones
                </Link>
              </li>
              <li>
                <Link
                  href="/legal-notice"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Aviso Legal
                </Link>
              </li>
            </ul>
          </nav>

          {/* Contact */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Contacto</h3>
            <p className="text-sm text-muted-foreground">
              ¿Tienes preguntas? Escríbenos a{' '}
              <a
                href="mailto:soporte@flota-camiones.com"
                className="text-primary underline hover:text-primary/80"
              >
                soporte@flota-camiones.com
              </a>
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-center text-xs text-muted-foreground sm:flex-row">
          <p>
            © {currentYear} Flota Camiones. Todos los derechos reservados.
          </p>
          <p>
            Desarrollado conforme al RGPD y la LSSI-CE
          </p>
        </div>
      </div>
    </footer>
  )
}
