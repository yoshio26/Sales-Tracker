# Dashboard manual checks

Run the application with the seeded database and sign in with an allowlisted address.

- Confirm the signed-in workspace shows current-month and all-time totals above the charts.
- Record an expense, then confirm the totals, daily current-month trend, monthly all-time trend, product breakdown, and category breakdown refresh.
- Archive or edit the product used by an existing expense, then confirm the dashboard still shows the expense's stored product and category labels.
- Delete an expense and confirm it is removed from every total and chart.
- Use a user with no non-deleted expenses and confirm zero totals, empty charts, and “No expenses recorded yet” without an error state.
- Temporarily make `/api/dashboard` fail and confirm an accessible error with a working Retry action.
- Check the signed-in view at narrow mobile, tablet, and desktop widths. Confirm cards/charts remain readable, chart summaries expose values as text, and all controls remain keyboard usable.