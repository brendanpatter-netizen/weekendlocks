# Auth email templates

Branded HTML for the four auth emails Supabase actually sends for this app
(confirmed against the code — `signUp`, `signInWithOtp`, `resetPasswordForEmail`,
and `updateUser({ email })` in `app/auth/login/index.tsx` and `app/account/index.tsx`).
Not auto-deployed — Supabase's dashboard is the source of truth for what's
actually live; these files are the version-controlled original.

## Applying a template

For each file below: Supabase dashboard → **Authentication → Email Templates**
→ pick the matching template → paste the file's contents into the **Message body**
field → set the **Subject heading** as noted in the file's own comment → Save.

| File | Supabase template | Subject to set |
|---|---|---|
| `confirm-signup.html` | Confirm signup | Confirm your WeekendLocks account |
| `magic-link.html` | Magic Link | Your WeekendLocks sign-in code |
| `reset-password.html` | Reset Password | Reset your WeekendLocks password |
| `change-email.html` | Change Email Address | Confirm your new email for WeekendLocks |

All four reference `https://weekendlocks.com/email-header.png` (from `public/`,
so it's a real, permanent, already-deployed URL — no upload needed on
Supabase's side).

## This only fixes how the email looks, not who it's from

These templates make the *content* say WeekendLocks. The **sender address**
is a separate, bigger lever for "does this look legit" — by default Supabase
sends from its own shared domain, which is exactly what can land in spam or
look unfamiliar. Fixing that needs custom SMTP (e.g. Resend) with your own
domain's SPF/DKIM records, configured under **Authentication → Settings →
SMTP Settings** — that part needs DNS access and dashboard configuration
this repo can't do on its own.
