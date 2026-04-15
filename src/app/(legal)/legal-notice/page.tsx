import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Aviso Legal",
  description:
    "Aviso Legal de Flota Camiones conforme a la LSSI-CE. Información del prestador de servicios de la sociedad de la información, propiedad intelectual y legislación aplicable.",
  keywords: [
    "aviso legal Flota Camiones",
    "LSSI-CE servicios información",
    "información legal trucking España",
    "prestador servicios transporte",
  ],
  openGraph: {
    title: "Aviso Legal | Flota Camiones",
    description:
      "Aviso Legal de Flota Camiones. Información identificativa del prestador de servicios conforme a la LSSI-CE.",
    url: "https://flota-camiones.com/legal-notice",
    siteName: "Flota Camiones",
    locale: "es_ES",
    type: "website",
  },
  alternates: {
    canonical: "https://flota-camiones.com/legal-notice",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function LegalNotice() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-8 text-4xl font-bold text-foreground">
        Aviso Legal
      </h1>

      <div className="space-y-8 text-muted-foreground">
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Información General
          </h2>
          <p>
            En cumplimiento con el artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se exponen los siguientes datos identificativos del prestador de servicios:
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Titular de la Plataforma
          </h2>
          <ul className="space-y-2">
            <li><strong>Denominación social:</strong> Flota Camiones</li>
            <li><strong>CIF/NIF:</strong> [Pendiente de inscripción]</li>
            <li><strong>Domicilio social:</strong> [Pendiente]</li>
            <li><strong>Email de contacto:</strong> legal@flota-camiones.com</li>
            <li><strong>Teléfono:</strong> [Pendiente]</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Registro Mercantil
          </h2>
          <p>
            [Pendiente de inscripción registral]
          </p>
          <p className="mt-2">
            La presente información será actualizada una vez completada la inscripción registral correspondiente.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Actividad
          </h2>
          <p>
            Flota Camiones es una plataforma web progresiva (PWA) de gestión integral de flotas de camiones, dirigida a empresas de transporte y autónomos del sector logístico en España.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Director de la Publicación
          </h2>
          <p>
            El director de la publicación es el responsable editorial de los contenidos publicados en la Plataforma.
          </p>
          <p className="mt-2">
            Para cualquier comunicación relacionada con el contenido de la Plataforma, puede contactar en: legal@flota-camiones.com
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Propiedad Intelectual e Industrial
          </h2>
          <p>
            Todos los elementos que conforman la Plataforma (software, textos, fotografías, gráficos, imágenes, tecnología, diseño, logotipos, marcas) son propiedad de Flota Camiones o de sus licenciantes y están protegidos por los derechos de propiedad intelectual e industrial.
          </p>
          <p className="mt-2">
            Queda prohibida la reproducción, distribución, comunicación pública o transformación de los mismos sin autorización expresa. El usuario se compromete a respetar estos derechos.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Enlaces a Terceros
          </h2>
          <p>
            La Plataforma puede contener enlaces a páginas web de terceros. Flota Camiones no asume ninguna responsabilidad sobre el contenido, información o servicios prestados por dichos terceros, siendo el usuario el único responsable de verificarlos.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Legislación Aplicable
          </h2>
          <p>
            El presente Aviso Legal se rige por la legislación española, en particular por:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE)</li>
            <li>Reglamento (UE) 2016/679 (Reglamento General de Protección de Datos — RGPD)</li>
            <li>Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD)</li>
            <li>Ley 32/2003, de 3 de noviembre, General de Telecomunicaciones</li>
            <li>Real Decreto-Ley 14/2019, de 31 de octubre, por el que se adoptan medidas urgentes por razones de seguridad pública</li>
            <li>Código de Comercio y normativa fiscal vigente</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Resolución de Conflictos
          </h2>
          <p>
            Para la resolución de cualquier controversia derivada del uso de la Plataforma, las partes se someten a los Juzgados y Tribunales de Madrid (España), renunciando expresamente a cualquier otro fuero que pudiera corresponderles.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Acceso y Uso de la Plataforma
          </h2>
          <p>
            El acceso a la Plataforma es libre y gratuito para los usuarios registrados. Flota Camiones se reserva el derecho a modificar, suspender o interrumpir el servicio en cualquier momento sin previo aviso.
          </p>
          <p className="mt-2">
            El usuario se compromete a utilizar la Plataforma de buena fe, conforme a las presentes condiciones y a la legislación vigente, y a no realizar actividades ilícitas o contrarias al orden público.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Cookies
          </h2>
          <p>
            Para más información sobre el uso de cookies en la Plataforma, consulte nuestra{' '}
            <a href="/terms" className="text-primary underline">
              Política de Cookies
            </a>
            {' '}incluida en los Términos y Condiciones.
          </p>
        </section>

        <p className="mt-8 text-sm">
          Última actualización: 13 de abril de 2026
        </p>
      </div>
    </main>
  )
}
