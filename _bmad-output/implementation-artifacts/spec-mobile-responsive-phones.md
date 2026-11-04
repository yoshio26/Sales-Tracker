title: 'Phone-responsive application layout'
type: 'feature'
created: '2026-11-04'
baseline_commit: 'b068d421eaa54a7a084b43e41300099deb10dca5'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The application is usable on desktop and has partial mobile styling, but several pages, forms, tables, dialogs, and navigation surfaces still overflow or waste space at phone widths.

**Approach:** Add phone-only CSS responsive rules for widths up to 32rem across the shared application styles and the two additional CSS modules. Preserve all desktop and wider responsive behavior, use the existing theme variables, and convert the stock table into CSS-styled stacked cards using its existing `data-label` attributes without changing React behavior.

## Boundaries & Constraints

**Always:** Edit styles only inside `@media (max-width: 32rem)` blocks. Keep `100vh` fallback immediately before `100dvh`; prevent horizontal page scroll; use 1rem page padding, 0.75rem content gaps, 44px tap targets, 16px form controls, safe-area padding, existing accent variables, and dark-mode compatibility. Preserve the existing fixed bottom navigation and keep content above it.

**Never:** Change desktop rules, rules for widths above 52rem, React logic, API calls, tests, or public behavior. Do not introduce data transformations or hide required stock information on phones.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| PHONE_LAYOUT | Viewport 360–430px wide | Every page fits its viewport with stacked controls, readable text, and no horizontal page scroll | Existing application errors remain unchanged |
| STOCK_CARD | Stock table with any row values, including long names/categories and low stock | Header is replaced visually by a stacked card; name/category lead; labeled values and actions remain readable; status chip sits below quantity | Long content wraps anywhere |
| DARK_THEME | Dark mode and any configured accent color | Phone navigation, cards, controls, and dialogs retain readable dark styling and dynamic accent colors | Existing theme behavior remains unchanged |
| SAFE_AREA | Phone with bottom safe-area inset | Fixed navigation remains usable and page content is not obscured | Fallback spacing remains available |

</frozen-after-approval>

## Code Map

- `FrontEnd/src/App.module.css` -- shared login, workspace, dashboard, stock, bought, history, notes, settings, guide, motivation, modal, picker, cart, pagination, and mobile-navigation styles; add phone overrides only in the existing or new max-width 32rem block.
- `FrontEnd/src/components/Toast/Toast.module.css` -- toast viewport and notification sizing; add phone-safe width/position rules in a max-width 32rem block.
- `FrontEnd/src/components/camellia/Camellia.module.css` -- Camellia page card/grid layout; add single-column phone rules in a max-width 32rem block.
- `FrontEnd/src/pages/DashboardStockTable.tsx` -- existing table markup and `data-label` values enable CSS-only stacked stock cards; do not change markup.
- `FrontEnd/src/pages/StockTrackerPage.tsx` -- product picker, cart, forms, purchase history, stock list, dialogs, and pagination consume shared styles.
- `FrontEnd/src/App.tsx` -- shared workspace shell and fixed mobile navigation; do not change logic or markup for this work.

## Tasks & Acceptance

**Execution:**
- [x] `FrontEnd/src/App.module.css` -- add comprehensive phone-only overrides for shell/login, workspace/header/nav, dashboard, charts/reports, stock/bought/history, CSS table cards, modals/forms, picker/cart, notes, settings/guide/motivation, pagination, viewport sizing, and overflow prevention.
- [x] `FrontEnd/src/components/Toast/Toast.module.css` -- constrain toast viewport and safe-area spacing at phone widths.
- [x] `FrontEnd/src/components/camellia/Camellia.module.css` -- stack Camellia content and reduce phone padding/headings.
- [x] Validate that no rules outside max-width 32rem changed and that no React, API, or test files changed.

**Acceptance Criteria:**
- Given a 360px, 375px, 390px, or 430px viewport, when any existing page is opened, then content has no horizontal page scroll and all controls remain usable.
- Given the dashboard, when viewed on a phone, then summaries, charts, report controls, and header content stack as specified and tabs remain horizontally scrollable when necessary.
- Given Stocks or Bought, when viewed on a phone, then filters and selection actions stack, stock rows render as labeled cards, and low-stock chips appear below quantities.
- Given any modal, picker, cart, history list, notes grid, settings, guide, motivation, or Camellia page, when viewed on a phone, then it fits the viewport, scrolls internally where needed, and preserves required actions.
- Given light/dark mode and a configured accent color, when viewed on a phone, then theme and accent styling remain consistent with desktop.
- Given desktop or any width above 52rem, when the application is viewed, then existing layout behavior is unchanged.

## Implementation Notes

The existing bottom-navigation styles in `App.module.css` are pre-existing working-tree changes and must be preserved while extending the phone rules. The stock table will use CSS `display` overrides, `data-label` pseudo-elements, and grid placement within the phone media query rather than React markup changes.

## Spec Change Log

## Review Triage Log

- `false` — The review claim that the phone-navigation breakpoint had been narrowed was disproven after restoring the pre-existing `max-width: 52rem` mobile-navigation rule; the new comprehensive overrides remain phone-only at `max-width: 32rem`.
- `patch` — Phone toast positioning could overlap the fixed navigation; the viewport bottom offset now reserves the navigation height plus safe-area inset.
- `patch` — Long phone dialogs lacked internal scrolling; `.modal` and `.stockErrorModal` now use `overflow-y: auto` in the phone block.
- `false` — Stock action buttons fit within the card because the existing phone rules stack the item actions and the table action group contains only the two 2.75rem icon buttons.
- `false` — Dark-mode stock-card labels remain readable through the existing shared muted text color and the card-specific dark-mode overrides; no required label information is hidden.
- `maybe-false` — Visual viewport checks for 360–430px, safe-area devices, and configured accent colors were not available in this run; browser inspection would settle the remaining visual risk.

## Verification

**Commands:**
- `npm run typecheck` -- expected: both server and frontend TypeScript checks pass.
- `npm --prefix FrontEnd run lint` -- expected: no new errors; existing warnings may remain.
- `npm --prefix FrontEnd run build` -- expected: production frontend build succeeds.
- `npm test -- --run` -- expected: existing tests pass.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- Inspect 360x800, 375x667, 390x844, and 430x932 with light/dark mode and multiple Settings accent colors; verify no horizontal scroll, no content hidden behind navigation, 44px controls, 16px inputs, and stacked stock cards.
