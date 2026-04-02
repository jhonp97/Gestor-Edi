import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryCard } from '@/components/dashboard/summary-card'
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react'

describe('SummaryCard', () => {
  it('debería renderizar el título y el valor', () => {
    render(
      <SummaryCard
        title="Ingresos"
        value="$1,500"
        icon={DollarSign}
      />
    )

    expect(screen.getByText('Ingresos')).toBeInTheDocument()
    expect(screen.getByText('$1,500')).toBeInTheDocument()
  })

  it('debería renderizar el icono correcto', () => {
    render(
      <SummaryCard
        title="Gastos"
        value="$500"
        icon={TrendingDown}
      />
    )

    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('debería aplicar estilos de variante income', () => {
    const { container } = render(
      <SummaryCard
        title="Ingresos"
        value="$1,500"
        icon={TrendingUp}
        variant="income"
      />
    )

    const valueElement = container.querySelector('.text-emerald-600')
    expect(valueElement).toBeInTheDocument()
    expect(valueElement).toHaveTextContent('$1,500')
  })

  it('debería aplicar estilos de variante expense', () => {
    const { container } = render(
      <SummaryCard
        title="Gastos"
        value="$500"
        icon={TrendingDown}
        variant="expense"
      />
    )

    const valueElement = container.querySelector('.text-red-600')
    expect(valueElement).toBeInTheDocument()
    expect(valueElement).toHaveTextContent('$500')
  })

  it('debería aplicar estilos de variante profit', () => {
    const { container } = render(
      <SummaryCard
        title="Ganancia Neta"
        value="$1,000"
        icon={BarChart3}
        variant="profit"
      />
    )

    const valueElement = container.querySelector('.text-blue-600')
    expect(valueElement).toBeInTheDocument()
    expect(valueElement).toHaveTextContent('$1,000')
  })

  it('debería usar variante default por defecto', () => {
    const { container } = render(
      <SummaryCard
        title="Transacciones"
        value="42"
        icon={DollarSign}
      />
    )

    const valueElement = container.querySelector('p.text-2xl')
    expect(valueElement).toHaveTextContent('42')
    expect(valueElement).not.toHaveClass('text-emerald-600')
    expect(valueElement).not.toHaveClass('text-red-600')
    expect(valueElement).not.toHaveClass('text-blue-600')
  })
})
