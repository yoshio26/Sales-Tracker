---
name: Sales Tracker visual design
status: draft
created: 2026-09-30
---

# Sales Tracker — Visual Design

## Direction

A calm, data-first dashboard for personal spending. The interface should feel trustworthy and lightweight rather than like a retail point-of-sale system.

## Screens

- Login: email entry, code entry, generic delivery message, retry and error states.
- Dashboard: total cards, spending-over-time chart, product/category charts, recent expenses.
- Products: searchable list, add/edit form, archive action, archived-state indicator.
- Expenses: add/edit form, ledger list, date/product filters, soft-delete confirmation.

## Layout

Use a responsive two-region layout: compact navigation/header and a primary content area. Dashboard cards precede charts; forms use clear labels and inline validation. Tables collapse into readable cards on narrow screens.

## Styling

Use CSS Modules, semantic HTML, accessible contrast, visible keyboard focus, restrained color, and consistent spacing. Charts must include text labels or accessible summaries so information is not conveyed by color alone.

## States

Every screen defines loading, empty, validation-error, server-error, and success states. Destructive archive/delete actions require confirmation; archived products remain visibly distinct.
