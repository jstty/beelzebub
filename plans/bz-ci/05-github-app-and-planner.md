# GitHub App, event ingestion, Checks, and planner

## Outcome

Accept GitHub events durably, turn them into exactly one logical planning/run request, safely plan
the exact source commit, and project independent CI results back to GitHub without depending on
GitHub Actions.

## GitHub App configuration

### Repository permissions

Initial minimum permissions:

| Permission | Access | Purpose |
| --- | --- | --- |
| Metadata | Read | Installation and repository identity |
| Contents | Read | Fetch workflow and repository source |
| Checks | Write | Create and update Check runs |
| Pull requests | Read | PR metadata, fork/base identity, changed files |
| Actions | Read | Migration parity and optional bridge correlation |

Optional permissions enabled only by features:

- pull requests write for explicitly configured PR comments;
- deployments write for deployment integration;
- issues write for issue comments;
- packages read/write for package workflows.

The product must continue operating for existing grants when an optional permission is not
approved. It presents a feature-specific diagnostic instead of requesting broad permissions at
installation.

### Webhook subscriptions

Required:

- installation;
- installation repositories;
- push;
- pull request;
- merge group;
- check run;
- repository rename, transfer, archive, and deletion events available to the App.

Optional feature subscriptions are documented with their permissions.

## Event gateway request lifecycle

```text
receive HTTPS POST
 -> enforce method/content type/body limit
 -> capture delivery/event headers
 -> verify HMAC over raw bytes
 -> parse minimal envelope
 -> insert webhook_deliveries row and raw payload reference
 -> commit
 -> return 202
 -> asynchronous event processor claims inbox row
```

The gateway target is durable response below one second p99 and always below GitHub's ten-second
delivery deadline under normal capacity.

### Request validation

- Require `X-GitHub-Delivery`, `X-GitHub-Event`, signature, and supported content type.
- Compare HMAC in constant time.
- Limit body before JSON parsing.
- Reject unsupported encodings.
- Store source IP and user agent for operations, subject to retention policy.
- Never log raw authorization/signature headers.
- Rotate webhook secrets with an overlap window.

### Durable tables

```text
webhook_deliveries
  id uuid primary key
  github_delivery_guid text unique
  event_name text
  action text null
  installation_external_id bigint null
  repository_external_id bigint null
  received_at timestamptz
  signature_key_id text
  payload_object_key text
  payload_sha256 bytea
  processing_state text
  processing_attempts integer
  next_attempt_at timestamptz null
  processed_at timestamptz null
  last_error_code text null

event_inbox
  id uuid primary key
  delivery_id uuid unique references webhook_deliveries
  event_kind text
  dedupe_key text
  available_at timestamptz
  claimed_until timestamptz null
  completed_at timestamptz null
```

Retain raw payloads long enough for support and replay, then delete under policy while retaining
safe delivery metadata.

## Event normalization

Convert raw provider payloads into a provider-neutral `WorkflowEventV1`:

- provider and delivery identity;
- installation and repository identity;
- event name/action;
- source SHA and ref;
- base SHA/ref where relevant;
- actor identity;
- PR/merge-group identifiers;
- changed files or a reference to lazily resolve them;
- fork and trust classification inputs;
- event time and receive time;
- raw payload digest/reference.

Normalization preserves fields required for audit and rerun. Rerun uses the stored normalized event
and selected source SHA, not whatever the branch points to later.

## Idempotency and logical-run keys

Webhook GUID deduplicates transport delivery. Logical run deduplication additionally uses:

```text
repository_id + workflow_id + source_sha + normalized_event_identity + trigger_variant
```

Examples:

- repeated delivery of one push produces one run;
- a manual rerun produces a new run with `rerun_of` and a unique command ID;
- a synchronize event for a new PR SHA produces a new run;
- a redelivery of the old synchronize event does not;
- a merge-group event is keyed by merge-group SHA and group identity.

Insert logical runs with a unique database constraint, not only an application check.

## Installation and repository synchronization

### Installation lifecycle

- created: create account link and synchronize selected repositories;
- new permissions: record pending versus accepted permissions;
- suspended: block new plan/run creation and revoke cached tokens;
- unsuspended: reconcile missed repository/events before resuming;
- deleted: revoke access, stop new work, apply retention/deletion policy.

### Repository lifecycle

- added/removed from installation;
- renamed or transferred;
- archived/unarchived;
- made private/public;
- deleted.

Use immutable GitHub repository IDs internally. Names and owners are attributes.

### Installation tokens

- Generate only in a service allowed to hold the App private key or signing key.
- Restrict token repositories and permissions to the immediate operation.
- Cache only within token lifetime and installation permission version.
- Never send a broad installation token to a runner.
- Mint a narrower checkout proxy token or short-lived archive URL for planners/runners.

## Event processor

For each claimed inbox row:

1. Load installation/repository state.
2. Reject or defer when installation access is invalid.
3. Normalize event.
4. Resolve candidate workflow paths from repository configuration.
5. Apply cheap trigger prefilters where safe.
6. Upsert planning request for exact workflow path and source SHA.
7. Commit domain events and outbox work.
8. Mark inbox complete.

Errors classify as permanent payload/configuration failure, permission wait, rate limit, or
transient provider/service failure. Retry policy differs by class.

## Reconciliation and redelivery

### Failed webhook redelivery

Scheduled worker:

1. List recent GitHub App deliveries since cursor.
2. Find failed deliveries not already accepted locally.
3. Request GitHub redelivery within the supported window.
4. Record request and outcome.
5. Alert after bounded repeated failure.

### Repository reconciliation

Periodic worker:

- list installation repositories with conditional requests;
- reconcile permission and repository lifecycle state;
- inspect recently updated open PRs and default-branch commits;
- compare expected logical run keys with local runs;
- create a synthetic reconciled event only when evidence shows an event was missed;
- never rerun merely because a GitHub Check projection is missing.

### Check reconciliation

- internal terminal run without completed Check -> enqueue projection;
- queued/running internal run with stale Check -> update projection;
- Check rerequest webhook -> validate creator and create explicit rerun command;
- duplicate Check from prior projection retry -> update known check ID, do not create another.

## GitHub Checks model

### Check suite/run naming

Use stable names suitable for branch protection:

```text
bz / <workflow name>
bz / <workflow name> / <logical job name>
```

Decide in ADR whether one required workflow Check summarizes jobs or each job is separately
required. Initial recommendation: workflow summary Check plus optional visible job Checks.

### Projection lifecycle

Internal state maps to GitHub:

- planning -> queued with planning details URL;
- waiting/ready/queued -> queued;
- any job running -> in progress;
- terminal -> completed with conclusion;
- planner/config failure -> completed failure with source diagnostics;
- approval wait -> queued with actionable details URL;
- no trigger match -> do not create a Check unless a pre-created check must be resolved.

### Annotation handling

- Normalize paths relative to repository root.
- Validate line/column ranges.
- Deduplicate by job, file, range, level, and message digest.
- Batch within GitHub API limits.
- Store full annotation set internally even if projection is truncated.
- Link Check details to complete bz diagnostics.

### Requested actions

Potential Check buttons:

- rerun failed;
- rerun all;
- cancel;
- approve trusted rerun, only when user has required repository role;
- open debug bundle.

Every action webhook is reauthorized against current installation/repository access and records an
audit event.

## Planner request model

```text
planning_requests
  id uuid primary key
  repository_id uuid
  source_sha text
  workflow_path text
  event_id uuid
  bz_version_constraint text null
  policy_hash text
  state text
  attempts integer
  plan_id uuid null
  check_projection_id uuid null
  created_at/started_at/completed_at
  unique(repository_id, source_sha, workflow_path, policy_hash, planner_inputs_hash)

workflow_plans
  id uuid primary key
  repository_id uuid
  source_sha text
  workflow_path text
  ir_version text
  plan_hash text
  policy_hash text
  planner_version text
  plan_object_key text
  diagnostics_object_key text
  created_at
  unique(repository_id, source_sha, workflow_path, plan_hash, policy_hash)
```

Plan caching never bypasses a changed policy hash, lockfile hash, planner version compatibility, or
workflow source digest.

## Exact source acquisition

Preferred path:

1. Resolve immutable repository ID and source SHA from normalized event.
2. Request archive or perform checkout with short-lived read-only credentials.
3. Verify fetched commit equals requested SHA.
4. Reject SHA unavailable due to force-push or permission change with a clear diagnostic.
5. Apply Git LFS/submodule policy explicitly.
6. Record source archive digest and acquisition method.

For fork PRs, obtain source under a token and repository identity that cannot write to base or fork.
Never execute a workflow definition taken from the base branch while silently running task code
from a different unreviewed SHA; the selected workflow/source policy is explicit and auditable.

## Planner sandbox

### Isolation requirements

- Separate ephemeral VM or equivalent strong sandbox for untrusted dependency lifecycle scripts.
- No control-plane VPC route.
- No customer job secrets.
- No GitHub App private key or broad installation token.
- Read-only source input and empty writable workspace/output volume.
- CPU, memory, disk, process, open-file, and wall-time limits.
- Maximum stdout/stderr and IR output sizes.
- Denied metadata-service access.
- Default-deny egress with optional dependency registry allow policy.

### Planner bootstrap

1. Start signed planner image.
2. Exchange one-time planner token for source/object URLs and plan submission scope.
3. Download and verify source bundle.
4. Select bz version from service policy and repository declaration.
5. Install project dependencies only when required and policy allows it.
6. Load workflow TypeScript.
7. Validate, normalize, canonicalize, and hash WorkflowPlanV1.
8. Upload plan and diagnostics directly to object storage.
9. Submit digest and terminal status with fenced planner attempt token.
10. Destroy sandbox and record cleanup result.

### Dependency policy

Modes:

- **isolated**: workflow may import only bundled bz SDK and relative source that needs no install;
- **lockfile**: allow package-manager install from approved registries with frozen lockfile;
- **custom**: run declared bootstrap in sandbox with explicit network policy.

Record package manager, lockfile digest, registries contacted, install duration, and resulting plan
dependencies. Do not upload full dependency contents by default.

### Planner output verification

The controller verifies:

- valid attempt token and lease;
- expected repository/SHA/path/policy;
- object size and digest;
- supported IR version and features;
- JSON Schema;
- canonical hash recomputation;
- source-map path containment;
- no unexpected secret-bearing fields.

Only then may it mark a plan valid and request run creation.

## Implementation work packages

### GH-01: App manifest and permission lifecycle

- App configuration for development/staging/production.
- Key rotation.
- Installation and repository synchronization.
- Permission acceptance UI and degraded behavior.

### GH-02: webhook gateway and durable inbox

- Raw-body verification.
- Database/object persistence.
- fast acknowledgement.
- dedupe and replay tooling.

### GH-03: normalization and logical run identity

- Typed provider-neutral events.
- event-specific normalization.
- trust inputs.
- unique constraints and rerun semantics.

### GH-04: Check projector

- queued/running/terminal mappings.
- annotation batching.
- outbox retry/rate limit.
- requested actions.

### GH-05: reconciliation

- Failed-delivery redelivery.
- repository/PR run reconciliation.
- Check repair.
- operator reports.

### PLAN-01: planner request/controller

- planning state machine.
- source acquisition.
- plan cache keys.
- attempt tokens and output verification.

### PLAN-02: sandbox image/runtime

- isolation limits.
- bz bootstrap.
- dependency modes.
- diagnostics and cleanup.

### PLAN-03: adversarial planner test suite

- infinite loop and fork bomb.
- memory/disk/output exhaustion.
- path escape and symlink attacks.
- metadata/control network attempts.
- malformed/huge IR.
- late or duplicated submission.

## End-to-end tests

- App install, repository selection, push, plan, Check completion.
- Same-repository and fork pull requests.
- Merge queue SHA.
- installation suspension during planning.
- repository removed before job queue.
- webhook duplicate and redelivery.
- GitHub API rate limit and outage.
- Check rerun/cancel action authorization.
- force-pushed/unavailable SHA.
- planner dependency install timeout.
- malicious workflow planning sandbox escape attempts.
- plan cache hit and policy invalidation.

Use a dedicated GitHub organization with disposable repositories and automated cleanup. Never run
destructive integration cases against the production repository.

## Exit criteria

- Webhooks are durably accepted and deduplicated before acknowledgement.
- Failed deliveries and missing logical runs reconcile automatically.
- Exact commit planning succeeds without control-plane or customer secret exposure.
- Malicious planner fixtures remain within defined resource and network boundaries.
- Valid plans are schema checked and hash verified before scheduling.
- GitHub Checks accurately project internal state and recover after API failure.
- Fork PR, permission change, suspension, deletion, rerun, and cancellation tests pass.
- A push completes an independent Check without invoking GitHub Actions.
