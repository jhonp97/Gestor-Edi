import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/trucks/[id]/page.tsx'),
  'utf8'
)

function extractBalancedObject(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker)
  if (markerIndex === -1) throw new Error(`Missing source marker: ${marker}`)

  const openingBraceIndex = source.indexOf('{', markerIndex)
  let depth = 0

  for (let index = openingBraceIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(markerIndex, index + 1)
  }

  throw new Error(`Unclosed object after source marker: ${marker}`)
}

describe('truck detail worker privacy', () => {
  it('selects only worker fields required by the page', () => {
    const workersQuery = extractBalancedObject(pageSource, 'workers: {')

    expect(workersQuery).toMatch(
      /select:\s*{\s*id:\s*true,\s*name:\s*true,\s*status:\s*true,?\s*}/
    )
    expect(workersQuery).not.toMatch(/\bdni(?:Hash)?\s*:/)
    expect(workersQuery).not.toMatch(/\bposition\s*:/)
    expect(workersQuery).toContain("orderBy: { name: 'asc' }")
  })

  it('renders the worker name link and status badge without a secondary identity line', () => {
    const assignedWorkersSection = pageSource.slice(
      pageSource.indexOf('{/* Trabajadores asignados */}'),
      pageSource.indexOf('{/* Transacciones con filtros */}')
    )

    expect(assignedWorkersSection).toContain('href={`/workers/${worker.id}`}')
    expect(assignedWorkersSection).toContain('{worker.name}')
    expect(assignedWorkersSection).toContain('<Badge')
    expect(assignedWorkersSection).not.toContain('worker.dni')
    expect(assignedWorkersSection).not.toContain('worker.position')
    expect(assignedWorkersSection).not.toContain('text-sm text-muted-foreground')
  })
})
