# Limen Launch Evidence Ledger

Date: 2026-06-15

Scope: Limen as the universal workflow intake and agent-launch surface, verified from the public repo, live Cloudflare Worker runtime, Firebase public surface, and GitHub issue state.

## Positioning

Limen is best positioned as the place work enters the machine: a task intake file, CLI/runtime contract, persona-gated web surface, and dispatch loop that can hand bounded work to agents while keeping public, client, and owner disclosures separate.

Do not position Limen as a general autonomous execution platform yet. The verified surface is intake, queue steering, dispatch, lifecycle/QA gates, redacted status, and runtime mutation behind owner tokens. Runtime agent execution still depends on configured local/remote agent commands and external agent CLIs.

## Authoritative Sources

- Repo: https://github.com/4444J99/limen
- README: https://github.com/4444J99/limen/blob/main/README.md
- Quickstart: https://github.com/4444J99/limen/blob/main/QUICKSTART.md
- Schema: https://github.com/4444J99/limen/blob/main/SCHEMA.md
- Agent protocol: https://github.com/4444J99/limen/blob/main/AGENTS.md
- Live public Firebase surface: https://device-streaming-067d747a.web.app/public
- Live Worker health: https://limen-runtime.ivixivi.workers.dev/health
- Live Worker public status: https://limen-runtime.ivixivi.workers.dev/api/public-status
- Live Worker public manifest: https://limen-runtime.ivixivi.workers.dev/api/surface-manifest

## Verified Repo Facts

- The README defines Limen as "Universal agent task intake" with `tasks.yaml` as the source of truth.
- Supported storage modes are local file via `LIMEN_TASKS`, GitHub Contents via `LIMEN_GITHUB_REPO`/`LIMEN_GITHUB_TOKEN`, and Worker inline YAML for local probing.
- Published surfaces are owner `/`, QA `/qa`, client `/client`, and public `/public`.
- Persona tokens are owner via `LIMEN_API_TOKEN` or `LIMEN_OWNER_TOKEN`, client via `LIMEN_CLIENT_TOKEN`, and unauthenticated public for public status, surface manifest, and health.
- CLI commands implemented in `cli/src/limen/cli.py` are `init`, `dispatch`, `release-stale`, `doctor`, `qa`, `status`, and `harvest`.
- Dispatch is dry-run by default. Live dispatch requires `--live` and mutates tasks only after a configured agent command succeeds or fails.
- Lifecycle steering exists through QA/readiness logic: assign, verify, recover, release stale, archive.
- Validation/probe coverage exists in scripts for schema validation, lifecycle adapter parity, local FastAPI runtime, local Worker runtime, static dashboard artifact privacy, and optional live runtime checks.

## Live Checks

Checked without owner or client secrets.

Worker runtime:

- `GET /health`: 200, JSON status `ok`.
- `GET /api/public-status`: 200, public aggregate only. Live runtime reported 100 total tasks, 28 completed, completion rate 0.28.
- `GET /api/surface-manifest`: 200, persona `public`, source type `cloudflare-worker`, storage mode `github`, repo `4444J99/limen`, branch `main`, path `tasks.yaml`, public surface and public contract only.
- `GET /api/client-status`: 401 without token.
- `GET /api/status`: 401 without token.
- `GET /api/qa-status`: 401 without token.
- `GET /api/readiness`: 401 without token.
- `GET /api/tasks`: 401 without token.
- `POST /api/dispatch`: 401 without token.
- `POST /api/release-stale`: 401 without token.

Firebase public surface:

- `GET /public`: 200 HTML public status surface.
- `GET /surface-manifest.json`: 200, persona `public`, static-build source, public surface and public contract only.
- `GET /public-status.json`: 200 public aggregate. Static artifact reported 100 total tasks, 20 completed, completion rate 0.20.
- `GET /client`: 200 token-entry client shell.
- `GET /qa`: 200 owner-token QA shell.
- Private static artifacts returned 404: `/tasks.json`, `/client-status.json`, `/internal-status.json`, `/qa-status.json`, `/readiness.json`, `/owner-surface-manifest.json`, `/client-surface-manifest.json`.

Evidence note: Firebase static public status is stale relative to the live Worker. Static `public-status.json` reports 20 completed, while the live Worker reports 28 completed. Treat the Worker as current runtime state and redeploy Firebase before public launch copy uses dashboard numbers.

## GitHub Issue State

Checked via GitHub REST issue API for `4444J99/limen`.

- Issues: 0 open, 2 closed.
- Closed issue 10: "Activation audit: publish and verify public status endpoint".
- Closed issue 9: "cloud-env-diagnostic 2026-06-06".
- Pull requests returned through the issues API: 5 open, 10 closed.
- Open PR 16: npm dependency group updates.
- Open PR 15: pip dependency group updates.
- Open PR 14: docker dependency group updates.
- Open PR 13: GitHub Actions dependency group updates.
- Open PR 8: "ops: realignment follow-on - auto-scale task creation test coverage".

## Actual Intake Objects

Task:

- First-class object in `tasks.yaml`.
- Fields include `id`, `title`, `description`, `repo`, `type`, `target_agent`, `priority`, `budget_cost`, `status`, `labels`, `urls`, `context`, `created`, `updated`, and `dispatch_log`.
- Verified statuses include `open`, `dispatched`, `in_progress`, `done`, `failed`, plus lifecycle support for stale, blocked/failed, and archived flows.

Client:

- Not a first-class `tasks.yaml` object.
- Implemented as a persona and redacted status contract. Client surfaces receive aggregate status plus redacted active tasks when authenticated with `LIMEN_CLIENT_TOKEN`.

Workflow:

- Implemented through task status, dispatch logs, QA/readiness gates, release-stale, verify, assign, archive, and dispatch operations.
- There is no separate workflow object; workflow state is derived from task fields and runtime adapters.

Budget:

- First-class board-level budget object with daily amount, unit, per-agent controls, tracking date, and task `budget_cost`.
- Dispatch filters by remaining budget and decrements only during live mutation.

Persona:

- Runtime persona is derived from bearer token matching owner or client token sets.
- Public persona is unauthenticated and limited to health, public status, and public manifest.

Proof:

- No dedicated proof object exists.
- Current proof is carried through `dispatch_log`, PR/issue URLs, task URLs, verification notes, QA reports, and generated probe/report artifacts.

Handoff:

- No dedicated handoff object exists.
- Current handoff is the dispatch prompt assembled from task title, repo, context, and URLs, plus the protocol in `AGENTS.md`.

## Reusable Intake Packets

These are valid Limen-style task packets. Before live dispatch, attach the actual repo when the target agent requires one and remove any client-private detail that should not be placed in an agent prompt.

```yaml
- id: UMA-INTAKE-001
  title: "Create UMA operator intake packet and proof checklist"
  description: "Turn the UMA operating question into a bounded Limen task with acceptance criteria, source URLs, and a proof path."
  type: documentation
  target_agent: any
  priority: 90
  budget_cost: 1
  status: open
  labels:
    - uma
    - intake
    - operator-dashboard
  urls: []
  context:
    objective: "Create an operator-ready packet for Universal Mail Automation work entering Limen."
    acceptance:
      - "Packet includes task scope, data source, expected output, and proof artifact."
      - "No credentials or mailbox-private content are included in task context."
      - "Owner can dispatch or defer from QA/readiness view."
    proof:
      - "Updated packet committed or linked."
      - "QA note records the source and redaction decision."
  created: "2026-06-15"
  updated: "2026-06-15"
```

```yaml
- id: STYX-INTAKE-001
  title: "Prepare STYX workflow entry packet"
  description: "Capture the STYX work request as a Limen task that can be triaged, dispatched, and verified without exposing secrets."
  type: workflow
  target_agent: any
  priority: 80
  budget_cost: 1
  status: open
  labels:
    - styx
    - intake
    - handoff
  urls: []
  context:
    objective: "Convert a STYX request into a dispatchable work packet."
    repo_required_before_live_dispatch: true
    acceptance:
      - "Scope names the concrete artifact to change or produce."
      - "Context separates public inputs from owner-only notes."
      - "Verification step names the expected proof artifact."
    proof:
      - "Task has repo or explicit no-repo rationale before live dispatch."
      - "Completion links PR, document, or runtime check."
  created: "2026-06-15"
  updated: "2026-06-15"
```

```yaml
- id: SS-INTAKE-001
  title: "Sovereign Systems client workflow intake"
  description: "Create a client-safe work packet for Sovereign Systems with a redacted client status path and owner-only execution notes."
  type: client-work
  target_agent: any
  priority: 85
  budget_cost: 2
  status: open
  labels:
    - sovereign-systems
    - client
    - redaction
  urls: []
  context:
    objective: "Make a Sovereign Systems work item visible through the right Limen persona surfaces."
    acceptance:
      - "Client-visible summary excludes secrets, internal estimates, and raw dispatch logs."
      - "Owner-only notes specify repo, branch, and verification command if needed."
      - "Public surface remains aggregate-only."
    proof:
      - "Client surface shows only redacted task fields."
      - "Owner surface or QA report contains the detailed verification path."
  created: "2026-06-15"
  updated: "2026-06-15"
```

```yaml
- id: PUBREC-INTAKE-001
  title: "Public records request intake and evidence trail"
  description: "Model a public-records workflow as a Limen task with deadlines, source links, response states, and proof artifacts."
  type: research
  target_agent: any
  priority: 75
  budget_cost: 1
  status: open
  labels:
    - public-records
    - evidence
    - deadlines
  urls: []
  context:
    objective: "Track a public-records request from intake to proof without mixing private notes into public status."
    acceptance:
      - "Request scope, agency, due date, and source URL are captured."
      - "Sensitive requester data is excluded from agent-visible context unless explicitly approved."
      - "Proof trail links request, response, appeal, or archive artifact."
    proof:
      - "Task URLs include public request or archive links where available."
      - "Final status includes response outcome and artifact location."
  created: "2026-06-15"
  updated: "2026-06-15"
```

```yaml
- id: CLIENT-INTAKE-001
  title: "Client work request launch packet"
  description: "Convert a new client request into a bounded Limen task with public/client/owner disclosure rules."
  type: client-work
  target_agent: any
  priority: 95
  budget_cost: 2
  status: open
  labels:
    - client
    - intake
    - launch
  urls: []
  context:
    objective: "Create the minimum packet needed to launch client work through Limen."
    disclosure:
      public: "Aggregate status only."
      client: "Redacted task title, status, next gate, and safe summary."
      owner: "Full task context, dispatch logs, URLs, and mutation controls."
    acceptance:
      - "Repo or delivery surface is named before live dispatch."
      - "Budget cost is set."
      - "Verification proof is defined before status can become done."
    proof:
      - "Client-safe status is available after tokened client check."
      - "Owner QA gate links completion proof."
  created: "2026-06-15"
  updated: "2026-06-15"
```

## Trust And Security Boundaries

- Public users can see health, public status, and public manifest only. They must not see tasks, dispatch logs, context, URLs, readiness, QA queues, or mutation endpoints.
- Client users authenticate with `LIMEN_CLIENT_TOKEN`. They may see redacted client status, not owner internals.
- Owners authenticate with `LIMEN_API_TOKEN` or `LIMEN_OWNER_TOKEN`. Owner persona is required for full status, tasks, readiness, QA, dispatch, assignment, verification, archive, and release-stale.
- Runtime GitHub storage is controlled by `LIMEN_GITHUB_TOKEN`; intake packets must never carry tokens or credentials.
- Dispatch prompts are built from task title, repo, context, and URLs. Anything placed in `context` or `urls` should be treated as agent-visible.
- Live dispatch should remain owner-only and dry-run by default. Use `--live` or POST mutation endpoints only after repo, budget, and proof path are set.
- Proof should be externalized as PR links, issue links, report artifacts, probe output, or QA notes. Do not treat "agent said done" as sufficient proof.

## Broken Or Drifted Paths

- README/Quickstart advertise `limen add` and `limen sync`, but the inspected CLI implements neither command.
- Quickstart says pip/Homebrew are "coming soon", so those are not launchable install paths.
- `install.sh` installs the CLI inside `cli/.venv` and creates `$HOME/limen`, but it does not clearly add the venv `limen` binary to PATH. README commands like `limen status` may fail after install unless the user invokes the venv binary or adjusts PATH.
- `AGENTS.md` still references Railway/Vercel-style SaaS deployment material while README/Quickstart center Firebase, Cloudflare Worker, GitHub Contents storage, and optional Cloud Run. This should be reconciled before external launch.
- Cloud Run deploy requires GCP billing, APIs, service account key, and secrets. The no-billing path is local CLI, GitHub Actions Operate workflow, and existing Cloudflare Worker runtime.
- Firebase static public status is stale relative to the Worker runtime and should be redeployed or labeled as a static snapshot.
- Jules dispatch depends on the `jules` CLI. Other agents default to `LIMEN_DISPATCH_CMD` or `agent-dispatch`, which must exist in the operator environment.
- Harvest is materially implemented for Jules; other agent harvest paths should be documented as pending or extended before claiming universal result collection.

## Screenshot List

- Firebase `/public` showing public aggregate status and no task details.
- Firebase `/client` showing client-token entry shell before authentication.
- Firebase `/qa` showing owner-token entry shell before authentication.
- Worker `/api/surface-manifest` public response showing only public surface/contract.
- Worker unauthenticated 401 responses for `/api/status`, `/api/client-status`, `/api/qa-status`, and `/api/tasks`.
- Owner-authenticated dashboard/status screenshots after tokens are available.
- CLI `limen qa` or `limen doctor` report after local install path is fixed or explicitly invoked through the venv binary.

## Portfolio Copy

Short:

Limen is my intake layer for agent work. It turns requests into bounded task packets, routes them through budget and persona gates, and exposes only the right amount of status to public, client, and owner surfaces.

Case study:

Limen started as a single `tasks.yaml` contract and grew into a public/service surface for agent-launch work. The public dashboard shows aggregate health. Client views are tokened and redacted. Owner views hold the task board, QA gates, dispatch controls, and readiness checks. The result is a practical operating boundary: work can enter the machine without handing every audience the same level of access.

Service offer:

Bring me a queue, backlog, client request stream, public-records workflow, or agent handoff problem. I will turn it into Limen-style packets with budget, proof, persona, and dispatch rules so the work can be triaged, launched, and verified without losing control of the boundary.

## Next Build Goal

Limen v0.2 launch hardening:

- Implement `limen add` and either implement or remove `limen sync` from docs.
- Fix installer PATH ergonomics or document the exact venv command.
- Redeploy Firebase so public static status matches current Worker state.
- Reconcile `AGENTS.md` with the current Firebase/Cloudflare/Cloud Run runtime story.
- Add a packet library or generator for domain intake packets.
- Add an explicit proof/verification convention to the schema docs, even if it remains stored in `context`, `urls`, and `dispatch_log`.
- Capture the screenshot set above and attach it to the portfolio case study.
