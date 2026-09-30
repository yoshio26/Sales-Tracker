---
name: Sales Tracker visual design
status: final
created: 2026-09-30
updated: 2026-09-30
---

# Sales Tracker — Visual Design

## Direction

A calm, data-first dashboard for personal spending. The interface should feel trustworthy and lightweight rather than like a retail point-of-sale system. The Login screen uses the **Dashboard Preview** direction: a quiet login panel sits beside a restrained preview of the value users will find inside the app.

## Login screen direction

Use a warm off-white page, a centered white browser frame, and a two-region layout. The left region contains the Sales Tracker mark, concise passwordless-login copy, email field, primary action, and generic delivery message. The right region previews monthly/all-time totals, spending over time, and recent spending using muted teal, soft green, and a small amber accent.

Reference mockup: [Login dashboard preview](mockups/key-login-dashboard-preview.html)

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

The Login screen's success state is an inline “Check your inbox” panel that explains the six-digit code expires in 10 minutes without revealing allowlist status.
