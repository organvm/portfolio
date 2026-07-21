# Consult API Worker

Cloudflare Worker backend for `/api/consult`.

## What it does

- Accepts public consult requests from the portfolio consult page.
- Attempts Workers AI inference (`@cf/meta/llama-3.1-8b-instruct`).
- Falls back to deterministic capability mapping if AI fails or times out.
- Logs full request records to D1 (`consult_logs`).

## Request / Response

`POST /api/consult`

Request JSON:

```json
{
  "challenge": "Need help designing a multi-agent content pipeline...",
  "industry": "saas",
  "page": "/portfolio/consult/",
  "requestId": "uuid"
}
```

Success JSON:

```json
{
  "ok": true,
  "mode": "ai",
  "analysisHtml": "<p>...</p>",
  "analysisText": "Plain text...",
  "requestId": "uuid",
  "durationMs": 482
}
```

Fallback JSON (`mode: "fallback"`):

```json
{
  "ok": true,
  "mode": "fallback",
  "analysisHtml": "<p>...</p>",
  "analysisText": "Plain text...",
  "requestId": "uuid",
  "durationMs": 121,
  "note": "Workers AI is unavailable right now. Showing deterministic capability mapping."
}
```

Error JSON:

```json
{
  "ok": false,
  "code": "BAD_INPUT",
  "message": "Challenge must be between 20 and 4000 characters.",
  "requestId": "uuid"
}
```

## Setup

1. Authenticate Wrangler:

```bash
npx wrangler whoami
```

2. Create D1 database:

```bash
npx wrangler d1 create portfolio-consult-logs
```

3. Copy returned `database_id` into `workers/consult-api/wrangler.jsonc`.

4. Apply migrations:

```bash
npx wrangler d1 migrations apply portfolio-consult-logs --config workers/consult-api/wrangler.jsonc --remote
```

5. Set secrets:

```bash
npx wrangler secret put LOG_HASH_SALT --config workers/consult-api/wrangler.jsonc
```

6. Deploy:

```bash
npx wrangler deploy --config workers/consult-api/wrangler.jsonc
```

7. Set frontend API base in deployment env:

`PUBLIC_CONSULT_API_BASE=https://<your-worker-subdomain>.workers.dev`
