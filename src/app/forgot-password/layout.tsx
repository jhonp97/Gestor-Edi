import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Recuperar Contraseña",
  description: "Recuperá el acceso a tu cuenta de Flota Camiones restableciendo tu contraseña.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
