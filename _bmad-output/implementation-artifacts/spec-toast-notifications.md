---
title: 'Accessible stock and API toast notifications'
type: 'feature'
created: '2026-11-03'
status: 'in-progress'
route: 'oneshot'
review_loop_iteration: 0
baseline_commit: 'fdc89ed2f40012982238d770e81b0dbd89b6c056'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Stock mutations and API errors need consistent, unobtrusive notification feedback without changing existing API logic.

**Approach:** Add `FrontEnd/src/components/Toast/ToastProvider.tsx` with `useToast()` success/error notifications and a theme-scoped viewport in `App.tsx`. Display notifications at bottom-right, independently dismiss them after 4 seconds, and provide keyboard-accessible manual close buttons. Use `--surface`, `--border`, and `--accent` with light/dark theme values, a polite live region, non-color status labels, responsive sizing, and reduced-motion styling. Notify after successful stock add/edit/delete, restock, quantity edits, and Settings stock actions; report existing API failures throughout the mounted frontend while preserving inline errors, generic authentication messages, request URLs/bodies, ordering, and refresh behavior. Do not patch global fetch or modify backend logic. Failed/partial mutations must never claim complete success. Verify timers, manual dismissal, multiple toast independence, accessibility markup, integration success/failure, frontend types, tests, and production build.

</frozen-after-approval>

## Implementation Notes

- No intent gaps or irreversible actions. All changes are frontend feedback, tests, and a DOM test dependency.
- Provider state lives above `App`; the viewport renders inside the app's theme scope to inherit dark mode and avoid existing generic button styles.