export default function PrivacyPolicy() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-8 text-4xl font-bold text-foreground">
        Política de Privacidad
      </h1>

      <div className="space-y-8 text-muted-foreground">
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Responsable del Tratamiento
          </h2>
          <p>
            De conformidad con el Reglamento General de Protección de Datos (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD), el responsable del tratamiento de sus datos personales es:
          </p>
          <p className="mt-2 font-medium text-foreground">
            Flota Camiones — Gestión Inteligente de Flota
          </p>
          <p>CIF/NIF: [Pendiente de inscripción]</p>
          <p>Domicilio: [Pendiente]</p>
          <p>Email de contacto: privacy@flota-camiones.com</p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Finalidad del Tratamiento
          </h2>
          <p>Tratamos sus datos personales con las siguientes finalidades:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Gestión de la cuenta de usuario y autenticación</li>
            <li>Gestión de flota de vehículos (camiones)</li>
            <li>Gestión de trabajadores y nóminas</li>
            <li>Gestión de transacciones financieras</li>
            <li>Envío de comunicaciones relacionadas con el servicio</li>
            <li>Cumplimiento de obligaciones legales (fiscales, laborales)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Base Jurídica del Tratamiento
          </h2>
          <p>La base legal para cada finalidad es:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong>Ejecución del contrato:</strong> gestión de la cuenta y servicios contratados
            </li>
            <li>
              <strong>Consentimiento:</strong> comunicaciones de marketing y cookies no esenciales
            </li>
            <li>
              <strong>Obligación legal:</strong> obligaciones fiscales, contables y laborales
            </li>
            <li>
              <strong>Interés legítimo:</strong> mejora del servicio y seguridad de la plataforma
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Derechos del Interesado
          </h2>
          <p>
            Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad de datos dirigiéndose por escrito a privacy@flota-camiones.com.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li><strong>Acceso:</strong> obtener una copia de sus datos personales</li>
            <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos</li>
            <li><strong>Supresión:</strong> solicitar la eliminación de sus datos</li>
            <li><strong>Oposición:</strong> oponerse al tratamiento en determinadas circunstancias</li>
            <li><strong>Limitación:</strong> solicitar que limitemos el uso de sus datos</li>
            <li><strong>Portabilidad:</strong> recibir sus datos en formato estructurado</li>
          </ul>
          <p className="mt-2">
            También tiene derecho a presentar una reclamación ante la Autoridad de Control Española (AEPD):{' '}
            <a href="https://www.aepd.es" className="text-primary underline" target="_blank" rel="noopener noreferrer">
              www.aepd.es
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Delegado de Protección de Datos (DPO)
          </h2>
          <p>
            Puede contactar con nuestro Delegado de Protección de Datos en:{' '}
            <a href="mailto:dpo@flota-camiones.com" className="text-primary underline">
              dpo@flota-camiones.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Plazos de Conservación
          </h2>
          <p>Conservamos sus datos personales durante los siguientes plazos:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Datos de cuenta: mientras mantengamos su cuenta activa y hasta 3 años después del cierre</li>
            <li>Datos fiscales (facturas, nóminas): 6 años según normativa fiscal</li>
            <li>Datos de trabajadores: 5 años tras la baja del trabajador</li>
            <li>Datos de transacciones: 6 años según normativa contable</li>
            <li>Consentimientos de cookies: 12 meses desde el último consentimiento</li>
            <li>Logs de auditoría: 5 años</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Cookies y Tecnologías Similares
          </h2>
          <p>
            Utilizamos cookies y tecnologías similares para garantizar el funcionamiento de la plataforma, analizar el uso y ofrecer publicidad personalizada. Puede gestionar sus preferencias de cookies a través de nuestro banner de cookies en su primera visita.
          </p>
          <p className="mt-2">
            Para más información, consulte nuestra{' '}
            <a href="/terms" className="text-primary underline">
              Política de Cookies
            </a>{' '}
            (incluida en los Términos y Condiciones).
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Cesión de Datos a Terceros
          </h2>
          <p>
            No cedemos sus datos personales a terceros, salvo obligación legal o cuando sea necesario para la prestación del servicio (por ejemplo, procesadores de pago). Todos los terceros que tratan datos por nuestra cuenta están sujetos a contratos de tratamiento de datos conforme al Art. 28 RGPD.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Transferencias Internacionales
          </h2>
          <p>
            No realizamos transferencias internacionales de datos personales fuera del Espacio Económico Europeo (EEE). En caso de que fuera necesario en el futuro, se garantizará un nivel de protección adecuado mediante decisiones de adecuación o cláusulas contractuales tipo.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Medidas de Seguridad
          </h2>
          <p>
            Implementamos medidas técnicas y organizativas apropiadas para proteger sus datos personales contra acceso no autorizado, pérdida, alteración o destrucción, incluyendo cifrado AES-256 para datos sensibles (DNI de trabajadores), hash SHA-256 para búsquedas, y protocolos de seguridad TLS en todas las comunicaciones.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">
            Modificaciones a esta Política
          </h2>
          <p>
            Podemos actualizar esta Política de Privacidad periódicamente. Cualquier cambio se publicará en esta página con una fecha de revisión actualizada. Le notificaremos cualquier cambio significativo a través del servicio o por correo electrónico.
          </p>
          <p className="mt-2">
            Última actualización: 13 de abril de 2026
          </p>
        </section>
      </div>
    </main>
  )
}
