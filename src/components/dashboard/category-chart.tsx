'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface CategoryChartProps {
  data: {
    category: string
    value: number
  }[]
}

const COLORS = ['#1e3a5f', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b']

export function CategoryChart({ data }: CategoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-muted-foreground">
        No hay datos suficientes para mostrar el gráfico
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="category"
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={50}
          label={(entry: unknown) => {
            const e = entry as { category: string; value: number }
            const pct = ((e.value / total) * 100).toFixed(0)
            return `${e.category} ${pct}%`
          }}
          labelLine={false}
        >
          {data.map((_entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: unknown, name: unknown) => [
            `$${Number(value).toFixed(2)}`,
            typeof name === 'string' ? name : 'Categoría',
          ]}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            fontSize: '14px',
          }}
        />
        <Legend
          formatter={(value: string) => value}
          wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
