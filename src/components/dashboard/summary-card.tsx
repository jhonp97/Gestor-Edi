import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface SummaryCardProps {
  title: string
  value: string
  icon: LucideIcon
  variant?: 'default' | 'income' | 'expense' | 'profit'
}

const variantConfig: Record<string, { color: string; bg: string; border: string }> = {
  default: {
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-800',
    border: 'border-t-gray-400',
  },
  income: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    border: 'border-t-emerald-500',
  },
  expense: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/40',
    border: 'border-t-red-500',
  },
  profit: {
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    border: 'border-t-blue-500',
  },
}

export function SummaryCard({ title, value, icon: Icon, variant = 'default' }: SummaryCardProps) {
  const config = variantConfig[variant]

  return (
    <Card
      className={cn(
        'group relative overflow-hidden rounded-xl border-0 bg-card transition-all duration-300 hover:shadow-lg',
        'shadow-[0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)]',
        `border-t-4 ${config.border}`,
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-base font-medium text-muted-foreground">{title}</p>
            <p className={cn('mt-2 text-2xl font-bold tracking-tight', config.color)}>
              {value}
            </p>
          </div>
          <div className={cn('flex size-12 items-center justify-center rounded-full', config.bg)}>
            <Icon className={cn('size-6', config.color)} aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
