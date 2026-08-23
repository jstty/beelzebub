# Runner agent and protocol

## Outcome

Run one authorized job attempt on customer or managed compute through an outbound-only,
versioned, fenced protocol. Stream trustworthy execution evidence while keeping control-plane
credentials and other tenants inaccessible.

## Protocol design principles

1. Agents initiate every network connection.
2. Bootstrap credentials identify a runner pool, not a job or user.
3. Job attempts use short-lived tokens bound to an active lease and fence.
4. Control messages are idempotent and versioned.
5. Large payloads transfer directly to object storage with signed URLs.
6. Logs resume by acknowledged sequence number.
7. The server decides authorization and failure classification.
8. Old agents are drained or rejected before claiming unsupported jobs.
9. Protocol libraries are independent from the CLI and task engine.

## Transport decision

**Decision required**: choose HTTP/JSON plus compressed binary log batches for v1, or gRPC.

Recommended v1:

- HTTPS JSON for registration, poll, claim, heartbeat, tokens, outputs, and terminal result;
- long polling to avoid inbound access and reduce idle traffic;
- zstd-compressed NDJSON or protobuf log batches with HTTP acknowledgement;
- server-sent cancellation in heartbeat response initially;
- optional HTTP/2 streaming after semantics stabilize.

This favors debuggability and simple enterprise proxies. The protocol package owns serialization so
transport can evolve without changing domain semantics.

## Version negotiation

Agent registration sends:

```ts
interface AgentHello {
  agentVersion: string;
  protocolVersions: string[];
  features: string[];
  platform: {
    os: 'linux' | 'windows' | 'macos';
    architecture: 'x64' | 'arm64';
  };
  runtime: {
    nodeVersion?: string;
    containerEngine?: string;
  };
  poolId: string;
  instanceIdentity?: ProviderInstanceIdentity;
}
```

Server returns selected protocol, required minimum agent version, enabled features, heartbeat
interval, maximum log batch, and upgrade/drain instruction.

An unsupported agent never receives job data.

## Credential types

### Pool bootstrap credential

- Created by an account administrator.
- Scoped to one runner pool and registration only.
- Stored by static agents or injected into runner controllers.
- Rotatable with overlap.
- Never sent into a job workspace.

### One-time instance credential

- Issued to a runner controller for one provisioned instance.
- Single use and short expiry.
- Bound to provider instance identity where possible.
- Exchanges for runner session after attestation/identity validation.

### Runner session token

- Bound to runner session, pool, negotiated protocol, capabilities, and expiry.
- Permits poll, claim, heartbeat, and drain status.
- Cannot read repository source, secrets, logs, or artifacts without an attempt lease.

### Attempt token

- Bound to account, job, attempt, lease ID, fence, runner session, and expiry.
- Permits exact job spec retrieval, log write, authorized capability token requests, output submit,
  and terminal result.
- Becomes invalid immediately when lease/fence changes.

### Capability token

Shorter tokens or signed URLs for:

- source checkout/archive;
- artifact read/write;
- cache read/write;
- secret retrieval;
- OIDC issuance;
- debug bundle upload.

Each has one operation, resource set, byte limit where applicable, and short expiry.

## Core endpoints

Illustrative REST surface:

```text
POST /v1/runner-sessions
POST /v1/runner-sessions/{session}/poll
POST /v1/attempts/{attempt}/claim
GET  /v1/attempts/{attempt}/spec
POST /v1/attempts/{attempt}/heartbeat
POST /v1/attempts/{attempt}/events
POST /v1/attempts/{attempt}/log-batches
POST /v1/attempts/{attempt}/capabilities/source
POST /v1/attempts/{attempt}/capabilities/artifacts
POST /v1/attempts/{attempt}/capabilities/cache
POST /v1/attempts/{attempt}/capabilities/secrets
POST /v1/attempts/{attempt}/capabilities/oidc
POST /v1/attempts/{attempt}/outputs
POST /v1/attempts/{attempt}/complete
POST /v1/runner-sessions/{session}/drain
```

Every attempt call supplies lease and fence through signed claims and an explicit request field to
prevent confused-deputy bugs.

## Poll and claim

### Poll request

Contains:

- session ID/version;
- available slots;
- current resource/capability advertisement;
- drain state;
- last configuration revision;
- bounded wait duration.

### Poll response

Either:

- no work plus next poll guidance;
- candidate attempt identity and matching summary;
- drain/upgrade/revoke instruction.

Candidate disclosure contains no secrets or repository content.

### Claim transaction

Agent sends candidate identity. Server atomically verifies:

- attempt remains queueable;
- runner session is active and allowed for account/pool;
- capabilities and resource class match;
- current quotas and budget permit start;
- runner version supports required features;
- no active lease exists.

Server increments fence, creates lease, and returns attempt token reference. Queue duplication is
therefore harmless.

## Job specification

```ts
interface JobSpecV1 {
  protocolVersion: string;
  accountId: string;
  repository: RepositoryCheckoutSpec;
  sourceSha: string;
  workflowPlanHash: string;
  runId: string;
  jobId: string;
  attemptId: string;
  attemptNumber: number;
  leaseId: string;
  fence: number;
  task: string;
  vars: Record<string, Serializable>;
  environment: Record<string, NonSecretValue>;
  secretRefs: SecretRequest[];
  services: PlannedService[];
  artifacts: PlannedArtifact[];
  cache: PlannedCache[];
  limits: AttemptLimits;
  timeouts: AttemptTimeouts;
  runtime: RuntimeRequirement;
  cleanup: CleanupPolicy;
}
```

Spec is immutable after lease except cancellation/deadline instructions. Its digest is recorded by
server and agent.

## Agent lifecycle

### Phase 1: host validation

- Verify agent signature/version at image build or launch.
- Detect OS, architecture, CPU, memory, disk, container engine, virtualization, and tools.
- Verify work root is dedicated and not a dangerous broad path.
- Check time synchronization and TLS trust.
- Register and advertise only verified capabilities.

### Phase 2: workspace

- Create a uniquely named attempt root.
- Apply owner and mode.
- Mount or allocate bounded scratch disk.
- Create separate source, temp, tool, service, and output paths.
- Start disk and process monitoring.
- Never reuse a prior job workspace in managed mode.

### Phase 3: source

- Request source capability.
- Fetch exact SHA through archive or Git.
- Verify repository and SHA.
- Enforce submodule/LFS policy.
- Prevent credentials from persisting in Git configuration.
- Emit checkout timing and source digest metadata.

### Phase 4: runtime/bootstrap

- Resolve pinned bz runtime.
- Verify downloaded tool digest/signature.
- Configure project package manager under declared policy.
- Restore tool/dependency caches through cache capability.
- Run bootstrap task with its own timeout and log group.

### Phase 5: services

- Pull images and record resolved digests.
- Create isolated job network.
- Mount only declared volumes.
- Start services and evaluate bounded health checks.
- Reject privileged requirements when pool does not advertise them.
- Capture service logs separately with secret masking.

### Phase 6: task execution

- Construct minimal environment from safe platform values, job vars, and resolved secrets.
- Register every secret with masker before any process receives it.
- Invoke bz task through argument vector without shell by default.
- Track process tree and resource use.
- Stream stdout/stderr and structured bz events.
- Poll/receive cancellation and deadline.
- Persist local sequence/cursor state for reconnect.

### Phase 7: finalize

- Flush task events.
- Validate and submit job outputs.
- Upload declared artifacts.
- Save authorized caches only under terminal policy.
- Stop services and capture bounded final logs.
- Submit preliminary result and cleanup-started event.

### Phase 8: cleanup

- Terminate remaining process tree.
- Unmount volumes and destroy job network/containers.
- Remove credentials, temp files, source, and outputs.
- Verify attempt root absence or destruction of the VM.
- Submit cleanup result where machine remains alive.
- Managed ephemeral instance terminates regardless of cleanup report.

## Process execution model

Extend `CommandRunner` or wrap it with attempt concerns:

- process group/job object tracking;
- stdout/stderr frame boundaries;
- byte and line limits;
- environment allow/deny policy;
- CPU/memory/disk sampling;
- soft and hard cancellation;
- explicit termination reason;
- cleanup of descendant processes;
- no host shell by default.

Map abort causes distinctly:

- user cancellation -> cancelled;
- execution deadline -> timed out;
- lease revoked -> lost/cancelled as server defines;
- agent shutdown -> infrastructure failure;
- command nonzero -> task failure;
- spawn error -> task or infrastructure classification based on evidence.

## Log and event protocol

```ts
interface AttemptFrame {
  sequence: number;
  timestamp: string;
  monotonicNanos: string;
  kind:
    | 'stdout'
    | 'stderr'
    | 'group_start'
    | 'group_end'
    | 'annotation'
    | 'task_start'
    | 'task_end'
    | 'metric'
    | 'agent_notice';
  taskId?: string;
  streamId?: string;
  payload: unknown;
}
```

Rules:

- Sequence begins at one and increments for every frame.
- Agent persists unacknowledged frames on bounded local disk.
- Batch includes first/last sequence, digest, encoding, and uncompressed size.
- Gateway acknowledges highest contiguous committed sequence.
- Duplicate batch is verified and acknowledged.
- Conflicting content for an existing sequence fences the agent and raises security incident.
- Backpressure pauses or spills process output; it never silently discards without an explicit
  truncation frame and failure policy.

## Secret masking

Masker receives exact secret bytes before use and supports configured encoded variants. It scans
across chunk boundaries and all log/event text fields.

Protections:

- minimum mask length unless explicitly forced;
- longest match first;
- bounded pattern set and memory;
- replacement before local disk log buffering where possible;
- structured values redacted by field classification;
- no secret echoed in mismatch or command diagnostics.

Masking reduces accidental disclosure; authorization prevents unauthorized access. Tests must not
treat masking as permission to send unnecessary secrets.

## Heartbeat and cancellation

Heartbeat contains:

- lease/fence;
- agent phase;
- last emitted/acknowledged frame;
- resource usage;
- active process summary;
- deadline view;
- optional progress.

Response contains:

- renewed expiry;
- cancel desired state and grace deadline;
- updated signed URLs/token expiry guidance;
- drain/upgrade instructions applying after current job.

On heartbeat loss, agent continues only for a bounded disconnected grace period. It cannot finalize
after token/lease expiry without revalidation.

## Output and completion protocol

Outputs upload before completion using declared names and schemas. Server stores them pending.

Completion request contains:

- spec digest;
- lease/fence;
- task outcome and evidence;
- command exit/signal;
- timestamps and phase durations;
- resource maxima;
- final log sequence;
- artifact/cache operation references;
- output digests;
- agent failure/cleanup status.

Server:

1. Validates active lease/fence.
2. Validates final log acknowledgement policy.
3. Verifies finalized artifacts/outputs.
4. Assigns trusted failure class and conclusion.
5. Atomically marks attempt terminal and exposes outputs.
6. Triggers scheduler progression and Check projection.

Duplicate identical completion returns prior result. Conflicting completion is rejected and
audited.

## Agent update and revocation

- Signed release manifest with version, protocol, features, digest, and minimum service version.
- Static agents may auto-update only when account policy enables it.
- Managed images are replaced through immutable image rollout.
- Critical revocation list blocks registration/claim.
- Active compatible attempts receive bounded completion grace unless security severity requires
  termination.
- Agent reports build provenance and image ID in session metadata.

## Debugging support

Initial safe support:

- downloadable debug bundle with agent version, phase timings, redacted config, process exit,
  service health, and last safe log frames;
- runner health check and `bz runner doctor`;
- no interactive SSH in first managed beta.

Interactive debug/SSH is post-GA and requires separate threat model, authorization, audit, timeout,
and retained-runner cost controls.

## Implementation work packages

### AGENT-01: protocol schemas and compatibility harness

- Hello/session/poll/claim/spec/heartbeat/frame/output/completion types.
- JSON Schema or protobuf definitions.
- current/prior version conformance.

### AGENT-02: session and credential client

- Bootstrap exchange.
- token refresh.
- drain/revocation.
- safe credential storage.

### AGENT-03: workspace and source

- Safe path creation.
- checkout/archive.
- exact SHA verification.
- cleanup.

### AGENT-04: services and process supervision

- Container services.
- process groups.
- resource limits.
- cancellation/timeout.

### AGENT-05: logs and resumable buffer

- Frame encoder.
- masking.
- disk spool.
- batch upload/ack/resume.

### AGENT-06: capabilities and finalization

- Secret/OIDC retrieval.
- artifacts/cache signed URLs.
- outputs.
- terminal result.

### AGENT-07: packaging, signing, update, doctor

- Linux x64/ARM64 artifacts or images.
- SBOM/provenance.
- update policy.
- diagnostic CLI.

### AGENT-08: provider conformance kit

- Launch disposable agent.
- execute/cancel/timeout/lose network.
- verify cleanup and token isolation.

## Test plan

### Protocol tests

- Unknown, old, and future version.
- Missing/unknown fields.
- expired token.
- wrong tenant/job/attempt/lease/fence.
- duplicate/conflicting frames and completion.
- oversized payload.

### Agent integration tests

- exact checkout and unavailable SHA;
- dependency bootstrap;
- stdout/stderr ordering;
- process-tree cancellation;
- service health failure;
- artifact/cache interruption;
- secret split across chunks;
- disk exhaustion;
- agent restart with local spool;
- cleanup verification.

### Adversarial job tests

- fork processes and leave descendants;
- fill disk and memory;
- attempt metadata-service access;
- read agent credentials;
- write outside workspace;
- symlink artifact escape;
- forge runner event/output;
- race cancellation and completion.

### Compatibility tests

Current service with prior supported agent, current agent with prior compatible service fixture, and
clear pre-claim refusal for unsupported feature requirements.

## Exit criteria

- Agent uses outbound-only connections and no control-plane credential.
- Every mutable attempt call is lease/fence authorized.
- Duplicate delivery, frame, and completion behavior is defined and tested.
- Cancellation terminates the process tree within configured grace.
- Logs resume without silent loss or reordering.
- Secrets are not present in persisted test logs or debug bundles.
- Static and Kubernetes providers pass one conformance suite.
- Managed-runner image destroys or proves cleanup after every attempt.
- Prior supported protocol version passes upgrade tests.
