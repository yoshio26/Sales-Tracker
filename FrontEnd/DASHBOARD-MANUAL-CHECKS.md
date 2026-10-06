# Dashboard manual checks

Run the application with the seeded database and sign in with an allowlisted address.

- Confirm the signed-in workspace provides Dashboard, Buy, Stock Tracker, Purchase History, and Settings navigation, with Settings immediately beside Purchase History.
- Add stock explicitly from Stock Tracker, then confirm the non-negative available quantity updates and zero-stock products remain visible.
- In Stocks, enable Add multiple stocks, enter one name per line, use a shared category/price/quantity, and confirm every named stock is created with the shared values.
- Confirm bulk stock creation rejects empty names, invalid shared values, and more than 50 names before creating any records; confirm duplicate names report the server error without hiding stocks already created.
- In Stocks, edit a product's name/category/price and confirm the updated price is shown in Stocks and used automatically for the next purchase; delete a product and confirm it leaves active Stocks while remaining available in the archived catalog.
- Buy a quantity within available stock and confirm the quantity decreases exactly once, the success feedback is accessible, and the entered values clear only after success.
- Attempt to buy more than available and confirm a conflict message appears while the entered quantity and cost remain unchanged.
- Open Purchase History and confirm records are newest first with quantity, total cost, UTC-derived timestamp, and captured product/category labels.
- Rename or archive a product after buying it and confirm the history labels remain unchanged.
- Confirm the signed-in workspace shows current-month and all-time totals above the charts.
- On Dashboard, confirm the available-stock table uses the headers Stock Name, Stocks, Sold, Updated Price, and Edit.
- Confirm Sold equals the sum of each product's bought quantities, including zero for products with no purchase history.
- Activate a row's edit icon and confirm Stocks opens with that product selected in the existing edit modal; save a price change and confirm Updated Price refreshes.
- Activate a row's delete icon, cancel the confirmation, and confirm the row remains; confirm deletion archives the stock and removes it from the dashboard table after refresh.
- Check the dashboard table in dark mode and at mobile width; confirm the table remains readable, horizontally scrollable when needed, and icon buttons expose accessible labels and visible focus states.
- Record an expense, then confirm the expense totals, daily current-month trend, monthly all-time trend, product breakdown, and category breakdown refresh without changing stock purchase metrics.
- Archive or edit the product used by an existing expense, then confirm the dashboard still shows the expense's stored product and category labels.
- Delete an expense and confirm it is removed from every total and chart.
- Open Settings, select Delete stocks, confirm the accessible warning panel starts at 10 seconds, moves visibly once per second, and verify Confirm remains disabled until the countdown reaches zero.
- Cancel during and after the countdown and confirm the panel closes without a DELETE request, data changes, or success notice.
- With unreferenced stock records, confirm deletion removes only the signed-in user's stock, purchase history, and expense records, refreshes Stocks/Dashboard, and shows accessible success feedback.
- With purchase history or expenses referencing stock, confirm the approved soft-delete policy preserves those records for recovery and excludes them from active views.
- Verify soft-deleted stock data older than 10 days is permanently purged and another user's active or retained records remain unchanged.
- Force the stock deletion transaction to fail and confirm active data remains visible, the error feedback is shown, and no success notice appears.
- In Settings, cancel an individual purchase-history deletion and confirm the entry remains; then confirm deletion removes only that entry, refreshes history/Dashboard, and shows no false success after a failed request.
- Use a user with no non-deleted expenses and confirm zero totals, empty charts, and “No expenses recorded yet” without an error state.
- Temporarily make `/api/dashboard` fail and confirm an accessible error with a working Retry action.
- Check the signed-in view at narrow mobile, tablet, and desktop widths. Confirm cards/charts remain readable, chart summaries expose values as text, and all controls remain keyboard usable.