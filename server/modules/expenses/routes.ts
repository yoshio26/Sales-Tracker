/// <reference path="../../types/express.d.ts" />

import { Router } from 'express'
import { z } from 'zod'
import { requireSameOrigin } from '../../middleware/origin.js'
import { requireSession } from '../../middleware/session.js'
import { createExpense, deleteExpense, getExpense, listExpenses, updateExpense } from './service.js'

const idSchema = z.object({ id: z.uuid() })
const amountSchema = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0 && Number(value) * 100 <= 2147483647)
const expenseSchema = z.object({ productId: z.uuid(), amount: amountSchema, quantity: z.number().int().positive().max(2147483647), note: z.string().trim().max(2000).optional(), spentAt: z.string().datetime({ offset: true }) })
const updateSchema = expenseSchema.partial({ productId: true }).extend({ updatedAt: z.string().datetime({ offset: true }) })
const listSchema = z.object({ from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(), productId: z.uuid().optional() })

function invalidInput(res: { status: (code: number) => { json: (body: unknown) => unknown } }) {
  return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter valid expense details.' } })
}

function notFound(res: { status: (code: number) => { json: (body: unknown) => unknown } }) {
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Expense not found.' } })
}

export const expensesRouter = Router()

expensesRouter.get('/', requireSession, async (req, res, next) => {
  try {
    const filters = listSchema.parse(req.query)
    if (filters.from && filters.to && new Date(filters.from) >= new Date(filters.to)) return invalidInput(res)
    res.json({ expenses: await listExpenses(req.userId!, filters) })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})

expensesRouter.get('/:id', requireSession, async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params)
    const expense = await getExpense(req.userId!, id)
    if (!expense) return notFound(res)
    res.json({ expense })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})

expensesRouter.post('/', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const outcome = await createExpense(req.userId!, expenseSchema.parse(req.body))
    if (outcome.kind === 'product-not-found') return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Active product not found.' } })
    res.status(201).json({ expense: outcome.expense })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof Error && error.message === 'Invalid amount') return invalidInput(res)
    next(error)
  }
})

expensesRouter.put('/:id', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params)
    const outcome = await updateExpense(req.userId!, id, updateSchema.parse(req.body))
    if (outcome.kind === 'not-found') return notFound(res)
    if (outcome.kind === 'product-not-found') return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Active product not found.' } })
    if (outcome.kind === 'stale') return res.status(409).json({ error: { code: 'STALE_EXPENSE', message: 'This expense changed. Refresh and try again.' } })
    res.json({ expense: outcome.expense })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof Error && error.message === 'Invalid amount') return invalidInput(res)
    next(error)
  }
})

expensesRouter.delete('/:id', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params)
    const outcome = await deleteExpense(req.userId!, id)
    if (outcome.kind === 'not-found') return notFound(res)
    res.status(204).send()
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})