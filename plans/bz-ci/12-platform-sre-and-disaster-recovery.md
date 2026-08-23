# Platform, SRE, and disaster recovery

Status: implementation plan

Owners: platform engineering, SRE, database, security

Depends on: all control-plane and data-plane service plans

## Outcome

Operate bz CI as a multi-tenant service whose failure behavior is understood, observable, recoverable, and practiced. The initial topology favors a small number of well-bounded services and managed infrastructure; it must not require a large operations team to remain safe.

## Environment and account model

Use separate cloud accounts/projects for:

- shared security/log archive;
- development;
- staging;
- production control plane;
- production runner workloads;
- image build and artifact signing.

Production access is federated, role-based, short-lived, and audited. Human administrators do not use static cloud keys. Infrastructure resources carry environment, service, owner, data-class, and cost-center tags.

Staging mirrors production architecture at smaller scale and receives the exact deployment artifact before production. Development can consolidate services but cannot share production data, keys, or networks.

## AWS reference architecture

The design remains portable at service boundaries, while the first managed deployment is explicit:

```text
GitHub/users
    |
Route 53 + ACM + WAF
    |
public ALB/API ingress
    |
ECS/Fargate services in private subnets
    |-- RDS PostgreSQL Multi-AZ
    |-- SQS queues + DLQs
    |-- ElastiCache only where proven necessary
    |-- S3 logs/artifacts/cache/exports
    |-- KMS + Secrets Manager
    |-- OpenTelemetry collectors
    |
isolated runner account/VPCs via public purpose-bound APIs
```

### Edge and ingress

- DNS health checks and certificate automation;
- WAF managed rules plus route-specific body/rate limits;
- separate webhook and user/API hostnames when scaling characteristics diverge;
- ALB access logs to restricted storage;
- strict TLS and HSTS;
- no direct origin bypass.

### Compute

Start with ECS/Fargate for stateless web/API, webhook processor, planner, scheduler workers, data API, and background workers. Services have independent task definitions, autoscaling policies, health checks, and deployment alarms. Kubernetes for the control plane is deferred unless its operational value exceeds its complexity.

### PostgreSQL

- RDS PostgreSQL Multi-AZ with storage autoscaling and encrypted volumes;
- separate application roles and pools by service;
- transaction pooling where compatible;
- query timeouts, connection budgets, slow-query capture, and schema ownership;
- point-in-time recovery and automated snapshots;
- read replicas only after workload evidence, not as an initial consistency shortcut;
- tenant/resource IDs in every domain table and indexes for hot queries.

PostgreSQL is the consistency authority for runs, jobs, leases, permissions, metadata, and outboxes.

### Queues

SQS standard queues carry at-least-once work notifications. Every consumer uses application idempotency and visibility extension. Each queue defines:

- message version and maximum size;
- visibility timeout tied to handler behavior;
- bounded retry/backoff;
- DLQ redrive count;
- oldest-message SLO;
- replay tool and authorization;
- poison-message quarantine rather than infinite retry.

Queue payloads contain references and immutable identifiers, not secrets or large workflow plans.

### Object storage

- separate buckets or strong prefixes/policies for logs, artifacts/cache, audit/export, and infrastructure logs;
- block public access and enforce TLS;
- KMS encryption with scoped roles;
- versioning where recovery needs it;
- lifecycle policies for incomplete multipart uploads, expiry, and noncurrent versions;
- object ownership and access logs;
- cross-region replication only for the data classes and recovery target that justify its cost.

### Keys and configuration

KMS keys are separated by purpose: database/storage, secrets envelope wrapping, OIDC signing, artifact signing, and audit. Runtime secrets live in Secrets Manager and are injected through task roles. Nonsecret config is versioned and validated. Rotation tests are part of releases, not only a document.

## Service deployment model

Each service artifact contains:

- immutable image digest;
- source commit and build provenance;
- SBOM and vulnerability scan result;
- schema/event/API compatibility metadata;
- default resource request/limits;
- health/readiness endpoints;
- dashboard and alert references;
- rollback compatibility declaration.

### Release sequence

1. Build, test, scan, sign, and publish once.
2. Deploy exact digest to an ephemeral integration environment.
3. Run migrations compatible with old and new application versions.
4. Deploy to staging and run synthetic plus failure-path tests.
5. Deploy production canary tasks receiving a bounded traffic/work share.
6. Evaluate automated health, latency, error, queue, and business correctness signals.
7. Roll out by service with dependency ordering.
8. Soak and then remove obsolete code/schema in a later release.

Rollback redeploys a prior compatible digest. It never attempts an unsafe database downgrade.

### Database changes

Use expand/migrate/contract:

1. add backward-compatible columns/tables/indexes;
2. deploy code that reads old and writes both/new as required;
3. backfill in resumable, rate-limited batches;
4. verify counts, constraints, and semantics;
5. switch reads behind a flag;
6. wait through rollback window;
7. remove old code and later contract schema.

Large indexes use online/concurrent mechanisms. Migration locks and duration are tested against production-scale data in staging.

## Infrastructure as code

Terraform modules cover accounts, networks, edge, compute, database, queues, buckets, observability, IAM, keys, budgets, and runner connectivity. Requirements:

- remote encrypted state with locking and restricted break-glass recovery;
- reviewed plans generated from the exact commit;
- policy checks for public exposure, encryption, IAM wildcard, backup, tags, and multi-AZ;
- drift detection at least daily;
- no manual production resources without documented emergency reconciliation;
- ephemeral stacks for integration tests where cost permits;
- module and provider version pinning.

## Observability

### Correlation

Propagate these identifiers where applicable:

```text
request_id, trace_id, event_id, delivery_id, tenant_id,
repository_id, run_id, job_id, attempt_id, runner_id,
outbox_id, queue_message_id
```

Tenant IDs may be present in restricted operational telemetry, but repository names, source, secret values, raw tokens, and command output do not belong in general service logs.

### Metrics

Golden signals by service plus product correctness:

- ingress request rate/error/duration/saturation;
- webhook validation, duplicate rate, processing lag, redelivery;
- planner queue/start/duration/failure/sandbox termination;
- scheduler loop duration, ready/queued age, lease conflict/expiry, fairness;
- runner ready/busy/draining/quarantined, boot time, disconnect, cleanup failure;
- log ingestion lag/gaps/spool pressure;
- artifact/cache upload errors, bytes, hit rate, reconciliation drift;
- PostgreSQL connections, locks, replication lag, transaction/query duration, storage;
- queue depth, oldest message, receive count, DLQ;
- OIDC/secret authorization denials and issuance errors;
- GitHub check projection lag and errors;
- usage ledger lag and billing discrepancy;
- synthetic end-to-end run success and duration.

Metrics with tenant/repository/run as unbounded labels are prohibited. Use logs/traces or sampled exemplars for high-cardinality correlation.

### Traces

Trace webhook ingestion through event processing, planning, run creation, scheduling, runner claim, data finalization, and GitHub projection. Sampling retains errors and rare slow paths while bounding cost. Trace attributes follow data-classification rules.

### Logs

Structured service logs include event name, outcome, reason code, duration, versions, and correlation IDs. They exclude raw headers, webhook bodies by default, source code, commands, secret values, and tokens. Security audit is a separate controlled stream.

## Service level objectives

Initial targets are hypotheses to validate during beta:

| User journey | SLI | Target |
| --- | --- | --- |
| API availability | good non-user-fault requests | 99.9% monthly |
| webhook acceptance | valid deliveries durably accepted | 99.95% monthly |
| event-to-run | valid events produce run/check or clear rejection | 99.9% within 30s |
| scheduler start | eligible common-pool jobs begin | 99% within 60s, capacity permitting |
| log visibility | durable frames visible | 99% within 3s |
| terminal projection | completed job reflected in GitHub | 99% within 60s |
| OIDC issuer | valid token requests succeed | 99.95% monthly |
| data durability | finalized artifact/log manifest retained | object-store durability plus tested controls |

Customer pool capacity, GitHub outages, user code duration, approval wait, explicit quota, and planned maintenance are categorized separately but remain visible.

### Error budgets

- page for fast security/data-loss risks and sustained severe SLO burn;
- freeze risky feature rollout when a journey exhausts budget;
- require corrective work and an owner before resuming;
- do not exclude platform-caused failures merely by relabeling them;
- publish customer-impact summaries from user-journey SLIs.

## Alerting

Alerts must be actionable and map to a runbook. Use multi-window burn-rate alerts for SLOs plus immediate alarms for:

- suspected security boundary violation;
- database unavailable or storage near exhaustion;
- OIDC signer/JWKS failure;
- webhook or scheduler pipeline completely stalled;
- significant log/artifact corruption;
- broad runner image/cleanup failure;
- unexpected cross-region/network exposure;
- billing ledger loss or duplicate spike.

Ticket lower urgency capacity, cost, drift, certificate, key rotation, and backlog risks. Alert tests run in staging and periodically in production-safe form.

## Capacity planning

Maintain a quarterly model and pre-launch load test for:

- events/second and burst deliveries;
- planner CPU/memory/time and dependency-fetch concurrency;
- active runs/jobs and scheduler decisions/second;
- runner polls/heartbeats and peak concurrency;
- log bytes/second and live viewers;
- artifact/cache ingress/egress and stored bytes;
- PostgreSQL row growth, IOPS, locks, and connections;
- queue throughput and retention;
- audit/usage event volume.

Define normal, expected peak, launch/beta limit, tested limit, hard quota, and scaling lead time. Apply admission control before a shared dependency collapses.

## Backup and restore

### Data classes and targets

| Data | Backup/replication | Initial RPO | Initial RTO |
| --- | --- | --- | --- |
| PostgreSQL control state | Multi-AZ, PITR, snapshots, copied backup | <= 5 min | <= 4 h |
| logs/artifacts/cache metadata | PostgreSQL plus object manifests | <= 5 min | <= 4 h |
| finalized artifacts/logs | object durability, version/lifecycle controls | <= 1 h where replicated | <= 8 h |
| cache bytes | lifecycle storage; rebuildable | best effort | best effort |
| audit/usage ledger | replicated/exported immutable storage | <= 5 min | <= 4 h |
| IaC/config | git plus state backup | last applied commit | <= 4 h |
| signing/encryption keys | managed key service backup/replica policy | provider guarantee | per key runbook |

Targets are confirmed with product/legal requirements before GA.

### Restore procedure

1. Incident commander selects an isolated recovery environment and recovery point.
2. Restore database without permitting normal traffic.
3. Validate schema, tenant counts, constraints, outbox sequence, and sampled resources.
4. Restore/reattach object indexes and run consistency scan.
5. Rotate credentials whose secrecy may be uncertain.
6. Start services in dependency order with consumers paused.
7. Reconcile leases, in-progress attempts, outboxes, queues, GitHub projections, and usage events.
8. Resume traffic gradually and monitor correctness signals.
9. preserve incident evidence and document lost/replayed window.

In-progress attempts at the recovery point are fenced and reclassified; never allow a pre-restore agent to mutate restored state.

### Restore testing

- automated database restore validation weekly;
- isolated full-service restore at least quarterly before GA;
- annual or major-change regional recovery exercise;
- object deletion/version recovery test;
- KMS/OIDC/GitHub key recovery and rotation drills;
- measure actual RPO/RTO and track every gap.

Backups are not considered valid until restored and application-level invariants pass.

## Regional strategy

Launch in one primary region with multi-AZ services. Prepare infrastructure and data contracts for a warm recovery region, but do not claim automatic active-active failover.

Regional failover requires:

- a controlled write fence in the old primary;
- restored/replicated PostgreSQL and object state;
- keys and secrets available under reviewed policy;
- queue/outbox reconciliation;
- DNS/ingress switch;
- revocation of outstanding runner credentials and fresh registration;
- GitHub delivery reconciliation from installation state;
- explicit failback plan.

Automatic failover is deferred until split-brain prevention and regularly exercised recovery justify it.

## Operational runbooks

Required before beta:

- API elevated errors/latency;
- webhook backlog and GitHub outage;
- planner backlog or malicious workflow pressure;
- scheduler stalled/lease storm;
- runner capacity shortage/image failure;
- log/artifact/cache object outage;
- PostgreSQL saturation/failover/restore;
- queue/DLQ replay;
- OIDC or secrets outage/key rotation;
- bad deploy and feature flag rollback;
- usage/billing discrepancy;
- tenant isolation/security incident;
- region loss.

Each runbook includes symptoms, impact test, safe diagnostics, containment, mitigation, recovery checks, escalation contacts/roles, communication triggers, and follow-up evidence.

## Incident management

- severity levels tied to user/security/data impact;
- 24/7 on-call before GA for the scoped production service;
- incident commander, operations, communications, and subject-matter roles;
- internal timeline from correlated events and audit logs;
- status communication with known/unknown clearly separated;
- blameless review focused on system conditions and verified actions;
- corrective items assigned with severity and due date;
- customer-visible postmortem for qualifying incidents.

## Chaos and game days

Inject in staging and controlled production scopes:

- duplicate/out-of-order queue delivery;
- process termination between database commit and message publish;
- PostgreSQL failover and connection exhaustion;
- queue/API/object-store latency and unavailability;
- GitHub API rate limit/outage;
- runner loss during claim, execution, and finalization;
- AZ capacity loss and image revocation;
- stale JWKS/key rotation;
- full log spool/backpressure;
- deploy rollback during mixed schema/protocol versions.

Every exercise states expected invariant, abort condition, observed behavior, and remediation.

## Cost management

- budgets and anomaly alerts by account/service/environment;
- unit costs per managed runner minute, plan, log GiB, artifact/cache GiB-month, and API run;
- object lifecycle and telemetry sampling reviewed against retention commitments;
- Fargate/database right-sizing driven by measured saturation;
- committed-use purchases only after stable demand;
- runner spot/warm-pool savings compared with interruption and idle cost;
- chargeback tags and invoice reconciliation.

Cost optimization never weakens isolation, backup, or observability without an explicit reviewed tradeoff.

## Work packages

### OPS-01: account, network, and IaC baseline

- build account boundaries, VPCs, edge, private service network, state backend, IAM federation, and policy checks;
- validate no public database/cache/runner lateral access.

Done when staging can be recreated solely from reviewed IaC.

### OPS-02: managed data services

- provision PostgreSQL, queues/DLQs, buckets/lifecycle, KMS, and secrets;
- add service roles, backup, encryption, and baseline alarms;
- test failure and restore paths.

Done when service owners pass connectivity, isolation, and recovery checks.

### OPS-03: deployment platform

- implement signed image pipeline, ECS services, canary rollout, feature flags, rollback, and schema migration automation;
- record provenance for every production task.

Done when a deliberately bad canary is stopped and reverted without state damage.

### OPS-04: telemetry and SLOs

- standardize metrics/logs/traces/correlation, dashboards, synthetics, SLO calculations, and actionable alerts;
- enforce telemetry data classification and cardinality budgets.

Done when an end-to-end synthetic failure is attributable across all services.

### OPS-05: capacity and resilience

- build load generators and production-size staging datasets;
- test admission control, autoscaling, quotas, dependency degradation, and queue recovery;
- publish tested limits.

Done when beta peak plus agreed headroom meets user-journey objectives.

### OPS-06: backup and disaster recovery

- automate backups, isolated restores, integrity checks, credential fencing, and recovery-region IaC;
- execute full restore and regional exercises.

Done when measured RPO/RTO meet approved targets and findings are closed.

### OPS-07: operations readiness

- create on-call, severity, runbooks, access procedures, status communications, and incident review process;
- conduct game days and handoff training.

Done when a responder unfamiliar with a subsystem can mitigate seeded incidents safely.

## Exit criteria

- Production is reproducible from IaC and immutable signed artifacts.
- Services deploy canary-first and schemas/protocols support rollback windows.
- User-journey SLOs, alerts, dashboards, and ownership are live.
- Load tests establish limits and admission control before public access.
- Database and object recovery are exercised, not assumed.
- Pre-restore runner/attempt credentials are fenced during recovery.
- Required runbooks and incident roles have passed game days.
- Security, cost, privacy, and operational evidence meet the GA gate.
