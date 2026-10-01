---
title: 'Send login codes through Gmail SMTP'
type: 'feature'
created: '2026-10-01'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Login-code delivery is configured for local Mailpit and the mailer hardcodes `secure: false`; production Gmail SMTP credentials and transport behavior need to work without leaving usable codes after delivery failure.

**Approach:** Configure the mailer from the existing SMTP settings, use STARTTLS for Gmail port 587 and implicit TLS only for port 465, update the example environment values with safe Gmail placeholders and commented Mailpit alternatives, and invalidate a newly created login code whenever sending fails while preserving the generic client response.

**Boundaries & Constraints**

**Always:** Pass configured SMTP credentials to Nodemailer, derive `secure` from the configured port (`true` only for 465), never read or modify the real `.env`, never log SMTP passwords, preserve generic anti-enumeration responses, and test the failure cleanup path.

**Never:** Commit changes, expose secrets, change the public authentication response contract, or remove Mailpit as a documented development alternative.

</frozen-after-approval>

## Code Map

- `server/infrastructure/mailer.ts` -- Nodemailer transport and login-code message construction; reuse `config.SMTP_*` and `config.MAIL_FROM`.
- `server/infrastructure/config.ts` -- validated SMTP host, port, credentials, sender, and environment configuration; do not read the real `.env`.
- `server/modules/auth/service.ts` -- creates login codes, sends mail, handles delivery failure, and owns the generic response contract.
- `server/modules/auth/data-access.ts` -- add the narrow login-code invalidation/delete operation beside `createLoginCode`.
- `server/modules/auth/service.test.ts` -- mock mail delivery and persistence to verify generic response plus cleanup on send failure.
- `.env.example` -- replace active SMTP examples with Gmail placeholders and retain Mailpit as commented alternatives.
- `.gitignore` -- verify `.env` remains ignored; do not modify unless verification shows otherwise.

## Tasks & Acceptance

**Execution:**
- [x] `server/infrastructure/mailer.ts` -- configure authenticated Nodemailer transport and derive `secure` from port -- support Gmail 587 and 465 correctly.
- [x] `server/modules/auth/data-access.ts` and `server/modules/auth/service.ts` -- invalidate the created login code on send failure and log sanitized real error details -- prevent usable codes after failed delivery.
- [x] `server/modules/auth/service.test.ts` -- cover delivery failure cleanup and generic response -- prevent regression.
- [x] `.env.example` -- add Gmail placeholders and commented Mailpit alternatives -- document local and Gmail setup without secrets.
- [x] `.gitignore` -- verify `.env` is ignored without exposing its contents -- protect credentials.

**Acceptance Criteria:**
- Given `SMTP_HOST=smtp.gmail.com`, port `587`, and credentials, when the mailer is created, then it uses the configured host, port, authenticated user/password, and `secure: false` for STARTTLS.
- Given SMTP port `465`, when the mailer is created, then `secure` is `true`.
- Given a login code is persisted and email sending throws, when `requestCode` completes, then the code is invalidated, the real error is logged without the password, and the generic response is returned.
- Given the example environment file is used, when SMTP settings are inspected, then Gmail placeholders are active and Mailpit settings remain available as comments.
- Given repository ignore rules are inspected, then `.env` remains ignored.

## Implementation Notes

- Updated Nodemailer transport creation to use configured SMTP host, port, credentials, sender, and `secure: SMTP_PORT === 465`; Gmail port 587 therefore uses STARTTLS.
- Added login-code invalidation after delivery failure, sanitized error logging, and a nested cleanup-error log while preserving the generic response.
- Added transport, persistence, delivery-failure, and cleanup-failure tests.
- Updated `.env.example` with requested Gmail placeholders and commented Mailpit alternatives. `.env` was not read or modified; `.gitignore` already contained `.env` protection.

## Review Triage Log

- verdict: patch — Added executable mailer tests for Gmail port 587 STARTTLS, port 465 implicit TLS, and configured credentials.
- verdict: patch — Added direct data-access coverage for the `usedAt: null` invalidation predicate and timestamp update.
- verdict: patch — Added cleanup-failure coverage proving the generic response remains stable and cleanup errors are logged.
- verdict: maybe-false/defer — If the database itself is unavailable during cleanup, no application-level retry can guarantee invalidation; the implementation logs the failure and preserves the safe client response. Proving durable invalidation would require an operational database retry/outbox design outside this task.
