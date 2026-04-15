import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Iniciar Sesión",
  description: "Iniciá sesión en tu cuenta de Flota Camiones para gestionar tu flota de camiones.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
