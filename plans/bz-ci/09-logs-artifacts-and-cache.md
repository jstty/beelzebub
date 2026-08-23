# Logs, artifacts, and cache

Status: implementation plan

Owners: data plane, runner agent, product

Depends on: [runner protocol](07-runner-agent-and-protocol.md), [security](10-security-secrets-and-oidc.md)

## Outcome

Deliver a durable data plane where users can watch logs live, download verified artifacts, and reuse safe caches without routing bulk bytes through the control-plane API. The service must tolerate duplicate frames, interrupted uploads, retries, and eventual consistency.

## Shared principles

- PostgreSQL stores ownership, authorization, lifecycle, and compact indexes.
- Object storage stores log chunks, artifacts, cache archives, and manifests.
- Runners use short-lived, attempt-scoped signed upload/download grants.
- Every stored object has tenant, repository, run, attempt, purpose, and expiry context.
- A record becomes downloadable only after explicit finalization and digest verification.
- User-visible metadata never claims success before the object is durable.
- Retention and deletion are asynchronous, idempotent, observable, and auditable.

## Log pipeline

### Runner frames

The runner sends ordered `AttemptFrame` records defined by the runner protocol:

```ts
type AttemptFrame = {
  attemptId: string;
  leaseEpoch: number;
  sequence: number;
  timestamp: string;
  stream: "stdout" | "stderr" | "system" | "annotation";
  stepId?: string;
  payload: string;
  payloadEncoding: "utf8" | "base64";
};
```

Maximum uncompressed frame size is bounded. Oversized process output is split without corrupting UTF-8. Sequences are unique per attempt and assigned after secret masking.

### Ingestion path

1. Agent batches consecutive frames by byte and time thresholds.
2. Ingest API validates attempt token, lease epoch, sequence range, and payload limits.
3. It records an idempotency key `(attempt_id, first_sequence, last_sequence, batch_digest)`.
4. The batch is compressed and written to object storage.
5. A compact chunk index is committed in PostgreSQL.
6. An event announces the durable high-water mark to live viewers.
7. Agent advances its acknowledged sequence and deletes the local spool segment.

If the API acknowledges only after durable storage and index commit, retrying the same batch cannot create visible duplicate lines.

### Object layout

```text
logs/v1/{tenant}/{yyyy}/{mm}/{run}/{job}/{attempt}/
  chunk-{firstSequence}-{lastSequence}-{sha256}.zst
  final-manifest.json
```

The final manifest contains chunk digests, sequence ranges, sizes, terminal status, masking-policy version, and final timestamp. Object keys are opaque to end users; downloads always pass an authorization check or use a short-lived URL.

### Live viewing

- API returns durable history from the chunk index and opens SSE/WebSocket from a requested sequence.
- The fanout tier carries hints, not the authoritative log.
- On disconnect, clients resume from the last rendered sequence.
- Gaps cause the client to refetch durable chunks, not wait indefinitely.
- Backpressure drops live notifications before it drops persisted frames.
- The UI can filter by step and stream while preserving the canonical sequence.

### Search and annotations

GA supports within-attempt text search using chunk scanning and lightweight indexes. Cross-organization log indexing is prohibited. Structured annotations are stored separately with file, line, severity, message, and step, while their corresponding display frame remains in sequence.

### Log limits and retention

- configure maximum frame, batch, attempt, job, and run log sizes;
- issue warnings before truncation;
- emit a visible terminal system frame if a hard limit is reached;
- default retention is policy-driven by plan and repository;
- legal hold is an explicit enterprise policy, not an accidental lifecycle bypass;
- deletion removes live indexes, objects, replicas, and derived search data.

## Artifact service

### Declaration and upload

A task declares an artifact through the runtime API:

```ts
await ctx.artifacts.upload({
  name: "coverage-html",
  paths: ["coverage/**"],
  ifNoFilesFound: "error",
  retentionDays: 14,
});
```

Execution flow:

1. Runtime validates name, path rules, policy, and quota.
2. Agent walks files without following unsafe symlinks outside the workspace.
3. Agent builds a canonical manifest with relative path, type, mode, size, and digest.
4. API creates an `artifact_upload` and returns multipart signed grants.
5. Agent creates a deterministic archive and uploads parts directly.
6. Agent finalizes with archive digest and manifest digest.
7. Service verifies uploaded size/parts/digests, marks artifact available, and emits an event.

Artifact names are unique within a run unless the declaration explicitly chooses immutable partition names. Silent overwrites are forbidden.

### Download authorization

- same-job reads may use the current attempt token;
- downstream jobs require plan-declared dependencies and artifact read permission;
- users require repository access and organization policy permission;
- public artifacts are not supported initially;
- signed URLs have short expirations and bind content disposition where supported;
- every grant and completed download is auditable at the appropriate privacy level.

### Integrity and security

- verify SHA-256 for archive and manifest;
- reject path traversal, absolute paths, device nodes, unsafe links, and decompression bombs;
- cap file count, expanded size, and compression ratio;
- expose malware/content scanning hooks before cross-boundary download;
- store provenance: producing workflow digest, job, attempt, source SHA, and image version;
- preserve failed-attempt artifacts only when declared and permitted by policy.

## Cache service

### Semantics

```ts
await ctx.cache.restore({
  key: `deps-${ctx.runner.os}-${lockDigest}`,
  restoreKeys: [`deps-${ctx.runner.os}-`],
  paths: [".cache/pnpm"],
});

await ctx.cache.save({
  key: `deps-${ctx.runner.os}-${lockDigest}`,
  paths: [".cache/pnpm"],
});
```

- exact keys win;
- restore prefixes choose the newest compatible entry deterministically;
- cache entries are immutable after finalization;
- concurrent saves to the same scope/key have a documented first-writer-wins result;
- a miss is normal and never fails a job unless workflow code chooses to;
- cache version includes archive format and normalized path set so incompatible archives do not match.

### Scope and trust

Cache lookup scope is derived by the service, not trusted from workflow input:

```text
tenant / repository / trust-domain / branch-or-base / user-key / cache-version
```

Trust rules:

- untrusted fork jobs may restore only caches explicitly safe for their base repository;
- untrusted jobs cannot publish entries later restored by protected-branch jobs;
- protected branches can be configured to consume only protected-branch writers;
- secrets and OIDC tokens are excluded by documentation and scanning heuristics but isolation must not rely on scanning;
- cross-repository caches require an explicit future policy and are disabled at launch.

### Save and restore lifecycle

Save uses artifact-style multipart upload and finalization. Restore returns a short-lived URL only after authorization and compatibility resolution. Agent downloads to a temporary file, verifies digest, validates archive entries, and extracts atomically into permitted workspace paths.

### Eviction and quotas

- account compressed bytes by organization and repository;
- track last successful restore, created time, and writer trust;
- enforce per-entry and total limits before issuing upload grants;
- use LRU within policy class, then absolute expiry;
- serialize or deterministically resolve eviction versus active restore;
- never bill or expose an unfinalized upload as a cache entry;
- garbage collect abandoned multipart uploads separately.

## Data model

Core tables:

```text
log_chunks(
  attempt_id, first_sequence, last_sequence, object_key,
  compressed_bytes, uncompressed_bytes, digest, created_at
)

log_manifests(attempt_id, final_sequence, object_key, digest, finalized_at)

artifacts(
  artifact_id, tenant_id, repository_id, run_id, job_id, attempt_id,
  name, status, object_key, archive_digest, manifest_digest,
  compressed_bytes, expanded_bytes, retention_until, created_at, finalized_at
)

artifact_upload_parts(upload_id, part_number, etag, bytes, digest)

cache_entries(
  cache_id, tenant_id, repository_id, trust_domain, branch_scope,
  user_key, cache_version, status, object_key, digest, bytes,
  writer_attempt_id, created_at, last_restored_at, expires_at
)

storage_deletion_jobs(resource_type, resource_id, generation, status, attempts, next_attempt_at)
```

Use unique constraints for frame ranges, artifact names, finalized cache scope/key/version, and deletion generation. Large usage records are emitted through the outbox rather than recalculated from storage listings.

## APIs

### Logs

- `POST /v1/attempts/{id}/log-batches`
- `POST /v1/attempts/{id}/logs/finalize`
- `GET /v1/attempts/{id}/logs?afterSequence=`
- `GET /v1/attempts/{id}/logs/stream?afterSequence=`
- `GET /v1/attempts/{id}/annotations`

### Artifacts

- `POST /v1/attempts/{id}/artifacts`
- `POST /v1/artifact-uploads/{id}/parts`
- `POST /v1/artifact-uploads/{id}/finalize`
- `GET /v1/runs/{id}/artifacts`
- `POST /v1/artifacts/{id}/download-grant`
- `DELETE /v1/artifacts/{id}`

### Cache

- `POST /v1/attempts/{id}/cache/resolve`
- `POST /v1/attempts/{id}/cache/uploads`
- `POST /v1/cache-uploads/{id}/finalize`
- `GET /v1/repositories/{id}/cache-usage`
- `DELETE /v1/cache-entries/{id}`

Attempt mutation endpoints require the current lease fence. User APIs support stable error codes and request IDs.

## Reconciliation

Periodic workers detect:

- database chunks without objects and objects without committed indexes;
- missing log sequences after terminal completion;
- stale multipart uploads;
- artifacts stuck in finalizing or deleting;
- cache entries whose object or digest is invalid;
- expired resources not yet deleted;
- object bytes that disagree with usage ledgers.

Automatic repair is safe only when ownership and digest are unambiguous. Otherwise quarantine the object, mark the resource unavailable, and create an operator-visible incident record.

## Work packages

### DATA-01: object-store abstraction and local backend

- define put, multipart, signed grant, head, range, lifecycle, and deletion interfaces;
- provide filesystem/in-memory implementations for deterministic tests;
- define tenant-key and metadata conventions.

Done when all higher services run locally without cloud credentials.

### DATA-02: durable log ingestion

- implement batch validation, idempotency, compression, chunk index, manifest, and agent spool acknowledgements;
- inject failures between every storage/database boundary;
- verify ordered replay after restart.

Done when duplicates and crashes cannot lose or duplicate visible lines.

### DATA-03: live logs and annotations

- implement resumable streaming, history handoff, step filtering, and structured annotations;
- add slow-client and fanout-outage behavior;
- meet first-log and resume latency targets.

Done when clients recover from disconnect using sequence alone.

### DATA-04: artifact upload and download

- implement safe packaging, multipart grants, finalization, integrity, authorization, and retention;
- add provenance and scanning state;
- build CLI and UI download paths.

Done when a downstream job and authorized user can retrieve the same verified bytes.

### DATA-05: cache resolution and isolation

- implement exact/prefix matching, immutable saves, trust scope, quota, eviction, and safe extraction;
- test fork and protected-branch poisoning attempts;
- report hit/miss reasons.

Done when authorization and deterministic matching pass adversarial tests.

### DATA-06: lifecycle and usage reconciliation

- implement expiration/deletion workers, abandoned-upload cleanup, usage ledger events, and consistency scanner;
- expose backlog and oldest-item metrics;
- document restoration limits after deletion.

Done when synthetic drift is detected and repaired or quarantined.

## Performance and reliability targets

- first durable log batch visible at p95 within 2 seconds of ingestion;
- live log notification p95 under 1 second excluding runner/network latency;
- reconnect resumes a 100 MB log without rereading it from sequence zero;
- artifact uploads use bounded agent memory and multipart retries;
- checksum verification detects every injected corrupt object;
- cache resolution p95 under 250 ms for the planned beta cardinality;
- object-service outage backpressures runners to bounded local spools and fails explicitly at limit;
- lifecycle backlog age remains below one hour in normal operation.

## Test matrix

- duplicate, overlapping, missing, late, and corrupt log frame batches;
- agent restart before and after acknowledgment;
- fanout unavailable while durable ingestion continues;
- artifact upload interrupted at every part and finalization boundary;
- malicious archive paths, links, devices, file counts, and compression ratios;
- concurrent same-key cache saves and restore-during-eviction;
- fork-to-protected cache poisoning and repository transfer;
- retention change, legal hold, deletion retry, and object-version behavior;
- quota boundary and usage-ledger reconciliation;
- tenant authorization fuzzing for every read and signed grant.

## Exit criteria

- Bulk data bypasses the control-plane API while authorization remains centralized.
- Logs are ordered, resumable, durable, masked, and finalized with a manifest.
- Artifacts are immutable, verified, provenance-linked, and policy-retained.
- Cache matches are deterministic and cannot cross repository/trust boundaries accidentally.
- Object and database drift is detected and reconciled.
- Storage usage feeds metering exactly once through auditable ledger events.
- Failure and adversarial tests cover upload, download, archive, and retention paths.
