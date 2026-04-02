'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface IncomeExpenseChartProps {
  data: {
    month: string
    income: number
    expense: number
  }[]
}

export function IncomeExpenseChart({ data }: IncomeExpenseChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-muted-foreground">
        No hay datos suficientes para mostrar el gráfico
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 14, fill: '#64748b' }}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          tick={{ fontSize: 14, fill: '#64748b' }}
          axisLine={{ stroke: '#e2e8f0' }}
          tickFormatter={(value: number) =>
            `$${(value / 1000).toFixed(0)}k`
          }
        />
        <Tooltip
          formatter={(value: unknown, name: unknown) => [
            `$${Number(value).toFixed(2)}`,
            name === 'income' ? 'Ingresos' : 'Gastos',
          ]}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            fontSize: '14px',
          }}
        />
        <Legend
          formatter={(value: string) =>
            value === 'income' ? 'Ingresos' : 'Gastos'
          }
          wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
        />
        <Bar
          dataKey="income"
          fill="#10b981"
          radius={[4, 4, 0, 0]}
          name="income"
        />
        <Bar
          dataKey="expense"
          fill="#ef4444"
          radius={[4, 4, 0, 0]}
          name="expense"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
