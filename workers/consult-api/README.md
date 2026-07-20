# Consult API Worker

Cloudflare Worker backend for `/api/consult` and `/api/contact`.

## What it does

- Accepts public consult requests from the portfolio consult page.
- Accepts contact capture submissions from the products gateway (`/products`) surface.
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

`POST /api/contact`

Request JSON:

```json
{
  "name": "Jordan Lee",
  "email": "jordan@example.com",
  "audience": "clients",
  "offer": "gamified-coach-interface",
  "message": "We need a pilot for an internal coaching dashboard.",
  "source": "products-gateway",
  "sourcePage": "/products/?audience=clients#contact-form",
  "requestId": "uuid"
}
```

Success JSON:

```json
{
  "ok": true,
  "requestId": "uuid",
  "message": "Contact request captured."
}
```

Error JSON:

```json
{
  "ok": false,
  "code": "BAD_INPUT",
  "message": "Message must be between 20 and 4000 characters.",
  "requestId": "uuid"
}
```

D1 schema:

- `consult_logs` continues to store `/api/consult` request telemetry.
- `contact_logs` stores `/api/contact` intake payload summaries (name/email/audience/message metadata and IP hash for rate-limiting correlation).
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
If the worker has already run migration `0001` in this environment, run again to apply `0002_create_contact_logs.sql`.

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
