import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Crear Cuenta",
  description: "Creá tu cuenta en Flota Camiones y empezá a gestionar tu flota de camiones hoy.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
