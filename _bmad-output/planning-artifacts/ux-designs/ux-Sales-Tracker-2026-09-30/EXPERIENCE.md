---
name: Sales Tracker user experience
status: draft
created: 2026-09-30
---

# Sales Tracker — Experience Flows

## Login

1. User enters email.
2. UI always displays the same delivery confirmation.
3. Allowlisted users receive a six-digit code through the configured SMTP transport.
4. User enters the code; errors do not reveal whether the email is allowlisted.
5. Success opens the dashboard; failure preserves the email and explains only the next safe action.

## Record an expense

1. User selects an active product.
2. User enters amount actually paid, quantity, note, and purchase date.
3. Server validates ownership and product state, then writes snapshots.
4. UI confirms the new ledger entry and refreshes dashboard data.

## Correct an expense

Users can edit amount, quantity, note, date, or product. Existing snapshots remain unchanged unless product changes. A stale update receives a conflict message rather than silently overwriting newer data.

## Archive a product

Archiving removes a product from new-expense selection but preserves existing expense references and historical chart labels.

## Dashboard interpretation

All totals and charts are calculated from non-deleted expenses. Product and category charts use expense snapshots, not current catalog values.

## Accessibility and feedback

Forms use labels, keyboard navigation, focus management, readable error messages, and non-color-only status indicators. Loading and empty states explain what the user can do next.
