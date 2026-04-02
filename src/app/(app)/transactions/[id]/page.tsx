import { redirect } from 'next/navigation'

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await params
  redirect(`/transactions`)
}
