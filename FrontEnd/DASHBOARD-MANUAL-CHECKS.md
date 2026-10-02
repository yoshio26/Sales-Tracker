# Dashboard manual checks

Run the application with the seeded database and sign in with an allowlisted address.

- Confirm the signed-in workspace provides Dashboard, Buy, Stock Tracker, Purchase History, and Settings navigation, with Settings immediately beside Purchase History.
- Add stock explicitly from Stock Tracker, then confirm the non-negative available quantity updates and zero-stock products remain visible.
- Buy a quantity within available stock and confirm the quantity decreases exactly once, the success feedback is accessible, and the entered values clear only after success.
- Attempt to buy more than available and confirm a conflict message appears while the entered quantity and cost remain unchanged.
- Open Purchase History and confirm records are newest first with quantity, total cost, UTC-derived timestamp, and captured product/category labels.
- Rename or archive a product after buying it and confirm the history labels remain unchanged.
- Confirm the signed-in workspace shows current-month and all-time totals above the charts.
- Record an expense, then confirm the expense totals, daily current-month trend, monthly all-time trend, product breakdown, and category breakdown refresh without changing stock purchase metrics.
- Archive or edit the product used by an existing expense, then confirm the dashboard still shows the expense's stored product and category labels.
- Delete an expense and confirm it is removed from every total and chart.
- Open Settings, cancel Delete stocks, and confirm no stock data changes or success notice appears.
- With unreferenced stock records, confirm Delete stocks requires confirmation, removes only the signed-in user's stock records, refreshes Stocks/Dashboard, and shows accessible success feedback.
- With purchase history or expenses referencing stock, confirm Delete stocks preserves the data and shows the safe conflict message.
- In Settings, cancel an individual purchase-history deletion and confirm the entry remains; then confirm deletion removes only that entry, refreshes history/Dashboard, and shows no false success after a failed request.
- Use a user with no non-deleted expenses and confirm zero totals, empty charts, and “No expenses recorded yet” without an error state.
- Temporarily make `/api/dashboard` fail and confirm an accessible error with a working Retry action.
- Check the signed-in view at narrow mobile, tablet, and desktop widths. Confirm cards/charts remain readable, chart summaries expose values as text, and all controls remain keyboard usable.