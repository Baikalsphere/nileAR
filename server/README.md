# Hotel Finance Backend

Node.js + PostgreSQL backend for the Hotel Finance portal.

## Quick start
1. Copy `.env.example` to `.env` and fill in values.
2. Apply the schema in `sql/schema.sql` to your Neon database.
3. Install dependencies: `npm install`
4. Run dev server: `npm run dev`

## Auth endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/corporate/login` (supports generated `userId` or saved company `contactEmail` as username)
- `GET /api/auth/corporate/me`
- `PUT /api/auth/corporate/profile`
- `POST /api/auth/corporate/set-password`

## Organization endpoints
- `GET /api/organizations`
- `POST /api/organizations` (requires `corporateEmail`; generated corporate `userId` is this email)
- `POST /api/organizations/send-credentials` (emails generated credentials to corporate email)

## Mail configuration
Set these in `.env` to enable credential email sending.

Provider selection:
- `MAIL_PROVIDER` (`smtp` or `resend`, default `smtp`)
- `SMTP_FROM` (sender email, required for both providers)

If `MAIL_PROVIDER=smtp`:
- `SMTP_HOST`
- `SMTP_PORT` (default `587`)
- `SMTP_SECURE` (`true`/`false`, default `false`)
- `SMTP_USER`
- `SMTP_PASS`

If `MAIL_PROVIDER=resend`:
- `RESEND_API_KEY`

For cloud deployments where Gmail SMTP times out, prefer `MAIL_PROVIDER=resend` since it uses HTTPS API delivery instead of raw SMTP.

Corporate first-time setup behavior:
- First login should use generated corporate `userId` + generated password.
- Until `/api/auth/corporate/set-password` is completed, login via company `contactEmail` is blocked.
- After company updates contact email and sets password, future logins can use `contactEmail` as username.

Tokens:
- Access token in JSON response.
- Refresh token in an HttpOnly cookie (`refresh_token`).
