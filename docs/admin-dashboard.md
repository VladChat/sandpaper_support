# Admin Dashboard

`/admin/` is a static admin dashboard for reviewing Supabase support data.

## Auth Model

The dashboard uses Supabase Auth email/password login from the browser. The browser only receives the public anon key from `assets/config.js`; after login, reads are sent to Supabase with the user's Auth access token.

No service role key belongs in browser code, static assets, GitHub Pages, or client-side configuration.

## Access Rules

Anonymous users can submit public support data such as search logs and feedback, but they cannot read logs, feedback, or draft solution cards.

Admin users must have either:

- `app_metadata.role = admin`, or
- an equivalent matching RLS policy in Supabase.

The source RLS file includes admin read policies for:

- `search_logs`
- `support_feedback`
- `draft_solution_cards`

If a logged-in user does not match the admin policy, the dashboard keeps the user signed in but shows a clear message that RLS may be blocking access.

## Dashboard Sections

The first version includes:

- Recent Search Logs
- Zero Result Searches
- Recent Feedback
- Not Helpful Feedback
- Draft Solution Cards placeholder section

The draft solution card area is read-only in v1. It is a placeholder review surface for future editorial workflows.

## Security Notes

- Do not add OpenAI calls to the admin page.
- Do not deploy or edit Supabase Edge Functions as part of the admin dashboard.
- Do not expose the Supabase service role key.
- Keep admin reads protected by Supabase Auth plus RLS.
- Public pages should continue to use anonymous insert-only behavior for feedback and search logging.
