import { redirect } from 'next/navigation'
import { getSessionUniversal } from '@/lib/session'
import { InvoiceEditor } from '@/components/facturas/invoice-editor'

export const dynamic = 'force-dynamic'

export default async function InvoicesPage() {
  const session = await getSessionUniversal()
  if (!session?.user?.organizationId || !session.user.id) redirect('/login')
  return <InvoiceEditor orgId={session.user.organizationId} userId={session.user.id} />
}
