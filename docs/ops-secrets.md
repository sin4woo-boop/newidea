# Secrets Operations Guide

## Scope
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `SUPABASE_SERVICE_ROLE_KEY`

## Storage Rules
- Production secrets are stored only in Vercel Environment Variables.
- Local secrets are stored only in `.env.local`.
- Never commit secrets to Git, docs, screenshots, or chat.

## Rotation Policy
- Rotate keys every 90 days.
- Rotate immediately if exposure is suspected, when team access changes, or when permissions are changed.

## Incident Response
1. Revoke leaked key immediately.
2. Issue a new key.
3. Update Vercel Environment Variables.
4. Redeploy production.
5. Review logs and unusual usage.

## Least Privilege
- Keep GCP service account permissions minimal.
- Use `SUPABASE_SERVICE_ROLE_KEY` only on server-side code.
- Use Supabase anon key only for client-side use cases.
