import { describe, expect, it, vi } from 'vitest'
import { getByCategory, getByProduct, getTimeSeries, getTotal } from './data-access.js'

function database() {
  return { $queryRaw: vi.fn().mockResolvedValue([]) } as never
}

function queryParts(db: { $queryRaw: ReturnType<typeof vi.fn> }) {
  const query = db.$queryRaw.mock.calls.at(-1)?.[0] as { strings: string[]; values: unknown[] }
  return { text: query.strings.join(' '), values: query.values }
}

describe('dashboard data access', () => {
  const range = { from: new Date('2026-10-01T00:00:00.000Z'), to: new Date('2026-11-01T00:00:00.000Z') }

  it('scopes totals to the session tenant, excludes soft-deleted rows, and uses half-open bounds', async () => {
    const db = database()
    await getTotal(db, 'user-a', range)
    const query = queryParts(db)

    expect(query.text).toContain('user_id =')
    expect(query.text).toContain('deleted_at IS NULL')
    expect(query.text).toContain('spent_at >=')
    expect(query.text).toContain('spent_at <')
    expect(query.values).toEqual(expect.arrayContaining(['user-a', range.from, range.to]))
  })

  it('leaves all-time totals unbounded by an artificial date range', async () => {
    const db = database()
    await getTotal(db, 'user-a')
    const query = queryParts(db)

    expect(query.text).not.toContain('spent_at >=')
    expect(query.text).not.toContain('spent_at <')
    expect(query.values).toEqual(['user-a'])
  })

  it('groups product and category reports by immutable expense snapshots', async () => {
    const db = database()

    await getByProduct(db, 'user-a', range)
    let query = queryParts(db)
    expect(query.text).toContain('product_name_snapshot')
    expect(query.text).not.toContain('JOIN products')
    expect(query.text).toContain('GROUP BY product_name_snapshot')

    await getByCategory(db, 'user-a', range)
    query = queryParts(db)
    expect(query.text).toContain('category_snapshot')
    expect(query.text).not.toContain('JOIN products')
    expect(query.text).toContain('GROUP BY category_snapshot')
  })

  it('uses UTC daily and monthly buckets without changing tenant or deletion predicates', async () => {
    const db = database()

    await getTimeSeries(db, 'user-a', range, 'day')
    let query = queryParts(db)
    expect(query.text).toContain("spent_at AT TIME ZONE 'UTC'")
    expect(query.values).toContain('day')
    expect(query.text).toContain('user_id =')
    expect(query.text).toContain('deleted_at IS NULL')

    await getTimeSeries(db, 'user-a', range, 'month')
    query = queryParts(db)
    expect(query.values).toContain('month')
  })
})
