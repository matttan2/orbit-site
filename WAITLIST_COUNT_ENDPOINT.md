# Waitlist Count Endpoint

The landing page can auto-update its signup count from a serverless endpoint, but the endpoint needs Google Sheet credentials that should never live in browser code.

## Vercel setup

Deploy the public `orbit-site` repo to Vercel, then add these environment variables:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Google service account email
- `GOOGLE_PRIVATE_KEY`: Google service account private key, with newline characters kept as `\n`
- `GOOGLE_SHEET_ID`: the ID from the Google Sheet URL
- `GOOGLE_SHEET_RANGE`: optional range to count, for example `Form Responses 1!A:A`
- `GOOGLE_SHEET_HEADER_ROWS`: optional number of header rows to subtract, defaults to `1`
- `ORBIT_ALLOWED_ORIGINS`: `https://matttan2.github.io`

Share the Google Sheet with the service account email as a viewer.

Once Vercel gives the endpoint URL, set it on the page before the main script runs:

```html
<script>
  window.ORBIT_WAITLIST_COUNT_ENDPOINT = "https://your-vercel-project.vercel.app/api/waitlist-count";
</script>
```
