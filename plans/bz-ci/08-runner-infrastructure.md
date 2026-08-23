# Runner infrastructure

Status: implementation plan

Owners: runner infrastructure, platform, security

Depends on: [runner protocol](07-runner-agent-and-protocol.md), [scheduler](06-control-plane-and-scheduler.md)

## Outcome

Provide interchangeable runner backends that execute the same job contract:

1. static customer-managed hosts for development and small installations;
2. customer Kubernetes clusters for BYOC execution;
3. a managed elastic Linux fleet comparable to hosted CI runners;
4. later, dedicated Windows and macOS pools without changing workflow semantics.

Every backend must pass the same conformance suite. Provider-specific behavior is represented as capabilities, never as hidden scheduler exceptions.

## Deployment modes

| Mode | Provisioner | Isolation boundary | Primary use | Availability target |
| --- | --- | --- | --- | --- |
| Static | operator/systemd | configured host account or container | local development, private hardware | best effort |
| BYOC Kubernetes | bz runner controller | pod and optional VM sandbox | enterprise/customer cloud | customer-defined |
| Managed standard | bz capacity manager | disposable VM plus job container | public SaaS | multi-AZ |
| Managed hardened | bz capacity manager | one microVM/VM per job | untrusted public workloads | multi-AZ |
| macOS | dedicated-host controller | ephemeral VM on dedicated Mac | Apple builds | region-limited |
| Windows | capacity manager | disposable Windows VM | Windows builds | region-limited |

The first production scope is Linux x86-64. Linux ARM64 follows after image and capacity tooling is proven. Windows and macOS remain explicit post-GA capability families.

## Common provider contract

Each provider implements:

```ts
interface RunnerProvider {
  reconcilePool(pool: RunnerPoolSpec): Promise<RunnerPoolStatus>;
  requestCapacity(request: CapacityRequest): Promise<CapacityReservation>;
  releaseCapacity(reservationId: string, reason: string): Promise<void>;
  describeCapacity(reservationId: string): Promise<CapacityStatus>;
  rotateBootstrapCredentials(poolId: string): Promise<void>;
  collectDiagnosticBundle(reservationId: string): Promise<DiagnosticRef>;
}
```

Required behavior:

- requests and releases are idempotent;
- reservations have immutable tenant, pool, architecture, and trust class;
- a provider emits observed state rather than claiming desired state succeeded;
- capacity is not schedulable until the agent authenticates and passes health checks;
- terminated capacity can never re-register under a prior instance identity;
- all instances have maximum lifetime and idle lifetime limits.

## Static runner plan

The static install path is the earliest end-to-end backend.

1. `bz runner install` creates a least-privileged service user and configuration directory.
2. The operator creates a pool in the control plane and receives a single-use enrollment token.
3. The agent exchanges the enrollment token for a renewable instance identity.
4. A preflight checks OS, architecture, free disk, required tools, clock skew, DNS, and outbound connectivity.
5. The agent advertises explicit capabilities and begins long polling.
6. Between attempts, the agent deletes the workspace, containers, services, credentials, and temporary mounts.
7. A periodic janitor verifies disk and process cleanup and marks the runner unhealthy on residue.

Static hosts are not described as safe for mutually untrusted repositories unless configured with a supported per-job sandbox.

## BYOC Kubernetes design

### Components

- Helm chart for namespace-scoped installation;
- runner controller deployment;
- optional node autoscaler integration;
- short-lived runner pods or sandboxed VM workloads;
- network-policy and workload identity templates;
- metrics and diagnostics endpoints.

### Custom resources

```yaml
apiVersion: ci.bz.dev/v1alpha1
kind: RunnerPool
spec:
  controlPlaneUrl: https://api.bz.dev
  organizationId: org_123
  labels: [linux, x64, docker]
  minIdle: 0
  maxRunners: 100
  podTemplate: {}
  isolation: pod # pod | gvisor | kata
```

`RunnerPool.status` reports desired, provisioning, ready, busy, draining, unhealthy, and quota-blocked counts. A `RunnerReservation` CRD is optional; begin with Jobs owned by the controller unless operational evidence requires a durable CRD.

### Pod lifecycle

1. Controller receives signed capacity demand or derives it from a pool demand stream.
2. It creates a Job with a unique runner identity and projected single-use bootstrap token.
3. Admission policy validates non-root execution, seccomp, read-only root filesystem where possible, resource limits, and approved images.
4. Agent registers, claims at most one job, executes, uploads final state, and exits.
5. Kubernetes deletes the Job after a short diagnostic TTL.
6. Controller reconciles stuck Jobs and revokes identities before deletion.

### Customer controls

- namespace and node selector/tolerations;
- resource requests and limits per runner size;
- private registry and proxy settings;
- egress allow/deny policy;
- workload identity/service-account binding;
- persistent cache gateway opt-in;
- custom CA bundles;
- maximum pool size and business-hour schedules.

Secrets supplied by bz use projected, memory-backed files and expire with the attempt. The Helm chart never embeds a permanent organization API token.

## Managed Linux architecture

### AWS reference topology

- an account per environment, with runner workloads isolated from the control plane account;
- regional runner VPCs spanning at least three availability zones;
- private subnets for runner instances and narrowly scoped egress gateways;
- capacity manager service with per-pool Auto Scaling Groups or EC2 Fleet requests;
- launch templates containing signed, immutable images;
- S3/VPC endpoints for approved artifact and log paths;
- no inbound path from the public internet or control-plane VPC;
- instance profiles limited to bootstrap identity exchange and telemetry.

### Image factory

Packer or EC2 Image Builder produces images from versioned source.

Each build must:

1. pin the base image by digest or image identifier;
2. install the bz agent, container runtime, common build tools, CA roots, and telemetry collector;
3. remove package-manager caches and build credentials;
4. generate an SBOM and vulnerability report;
5. boot an instance and run the runner conformance suite;
6. sign the manifest and record provenance;
7. publish first to a canary image channel;
8. promote the exact image ID after soak.

Images have a retirement timestamp. The scheduler rejects claims from retired images after a controlled drain window.

### Instance boot flow

1. Instance receives a workload identity from the cloud provider.
2. Bootstrap service verifies account, region, launch-template ID, image ID, and instance tags.
3. It returns a single-use agent credential bound to the pool and instance.
4. Agent sends its signed image manifest, capabilities, clock, and health results.
5. Control plane marks it ready only if policy accepts all attributes.
6. After one job, the default hardened runner shuts down; warm reusable runners execute an attested cleanup and have a strict job limit.

### Isolation profiles

| Profile | Boundary | Intended trust | Reuse |
| --- | --- | --- | --- |
| Standard | dedicated VM per runner, container per job | private repository | limited and policy-controlled |
| Hardened | fresh VM or microVM per job | forks/public code | none |
| Privileged | dedicated VM with nested/container privileges | explicitly approved jobs | none |

Fork pull requests never run on a reusable privileged runner. Runner trust class is part of queue matching and cannot be downgraded by workflow code.

### Network policy

Default managed runners permit outbound internet access but block:

- cloud instance metadata except the bootstrap proxy;
- control-plane private address ranges;
- other runner subnets and tenant workloads;
- link-local and reserved networks not required by the runtime.

Organizations may select a stricter egress policy. The job spec receives the resolved policy ID, while enforcement remains outside the job process. DNS and connection metadata are retained only at the granularity and duration stated in the privacy policy.

## Capacity management

### Inputs

- queued jobs by capability, trust class, organization tier, and age;
- ready, booting, busy, and draining runners;
- observed boot and job duration distributions;
- cloud quota and spot interruption signals;
- pool min/max and budget constraints;
- target queue-start SLO.

### Desired capacity

For each pool, calculate:

```text
required = ceil(eligible_queue / jobs_per_runner)
headroom = percentile(arrival_rate * boot_time, configured_confidence)
desired = clamp(min_idle + required + headroom, min_size, max_size)
```

The production algorithm must also cap organization share, respect provider quotas, and damp oscillation. Record every scaling decision with its inputs so operators can replay it.

### Warm pools

- maintain warm capacity only for common size/architecture/trust tuples;
- never place tenant data in the base warm snapshot;
- expire unused warm instances aggressively;
- allocate capacity fairly rather than allowing one tenant to consume the entire ready pool;
- turn off a warm pool automatically if cleanup or attestation checks fail.

### Spot capacity

Spot is initially limited to opt-in retry-safe jobs. The runner reports interruption notices, scheduler classifies the attempt as infrastructure failure, and retry policy can move the next attempt to on-demand capacity. Pricing must not charge for platform-caused interrupted minutes.

## Runner sizes and capabilities

Sizes are immutable catalog entries:

```text
linux-x64-small:  2 vCPU,  8 GiB,  50 GiB ephemeral
linux-x64-medium: 4 vCPU, 16 GiB, 100 GiB ephemeral
linux-x64-large:  8 vCPU, 32 GiB, 200 GiB ephemeral
linux-arm64-small: 2 vCPU, 8 GiB, 50 GiB ephemeral
```

The catalog records CPU architecture, virtualization, disk, GPU, nested-virtualization, and pricing dimensions. A workflow selects logical requirements; policy maps them to permitted catalog entries. Exact cloud instance types remain an implementation detail.

## Infrastructure as code

Create reusable modules for:

- runner regional network and endpoints;
- capacity manager IAM;
- image factory and signing keys;
- standard and hardened launch templates;
- fleet/Auto Scaling configuration;
- metrics, logs, alarms, and budgets;
- Kubernetes Helm chart and example Terraform installation;
- organization-specific private connectivity as a later module.

All changes run formatting, static validation, security scans, plan review, and ephemeral-environment integration tests. Production applies require an approved artifact generated from the reviewed commit.

## Reliability and failure handling

| Failure | Detection | Required response |
| --- | --- | --- |
| boot timeout | reservation deadline | revoke identity, terminate, replace |
| agent never registers | bootstrap metric and deadline | quarantine image/pool if correlated |
| agent disconnects | expired lease | cancel attempt, retry by policy |
| cloud API throttles | provider metrics | exponential backoff, reduce churn |
| AZ capacity loss | fleet error | shift within region, alert reduced headroom |
| spot interruption | metadata notice | cancel cleanly and retry if eligible |
| cleanup failure | attestation/janitor | quarantine and destroy runner |
| compromised image | security revocation | stop new claims, drain/destroy, rotate credentials |
| customer cluster offline | missed controller heartbeat | expose degraded pool and leave jobs queued |

Quarantine always removes a runner from scheduling before diagnostics are collected.

## Work packages

### INFRA-RUN-01: provider interface and fake provider

- define provider state and idempotency contracts;
- implement a deterministic in-memory provider for scheduler tests;
- add conformance fixtures covering lifecycle and failures.

Done when any backend can be validated without scheduler-specific test code.

### INFRA-RUN-02: static installer

- package agent for Linux;
- implement enrollment, service install, health checks, upgrades, and uninstall;
- document security limits and recovery.

Done when a clean VM can enroll and execute an end-to-end test in under 15 minutes.

### INFRA-RUN-03: Kubernetes controller

- ship Helm chart, controller, RBAC, network policies, and ephemeral Jobs;
- implement gVisor/Kata capability selection behind feature flags;
- test cluster disconnect, upgrades, and orphan cleanup.

Done when the conformance suite passes on two supported Kubernetes versions.

### INFRA-RUN-04: image factory

- build, scan, sign, test, promote, revoke, and retire Linux x86-64 images;
- expose manifest verification to agent registration;
- create canary and rollback runbooks.

Done when image promotion is fully reproducible and a revoked image cannot claim work.

### INFRA-RUN-05: managed capacity manager

- implement fleet reconciliation, boot deadlines, quotas, and scaling decisions;
- add standard and hardened pool profiles;
- integrate instance identity bootstrap.

Done when burst, scale-down, AZ-loss, and cloud-throttle tests meet targets.

### INFRA-RUN-06: isolation and cleanup verification

- adversarially test filesystem, process, container, network, metadata, and credential boundaries;
- prove destruction or cleanup after each job;
- produce audit evidence per image version.

Done when security accepts the threat-model test suite for untrusted jobs.

### INFRA-RUN-07: ARM64 and special capability pools

- add multi-architecture builds and catalog mapping;
- validate container manifests, toolchains, cache isolation, and pricing dimensions;
- define designs—not implementation promises—for Windows, macOS, and GPU pools.

Done when ARM64 achieves Linux x86-64 protocol parity.

## Verification plan

- provider contract tests run against fake, static, Kubernetes, and managed backends;
- 1,000-run soak verifies no cross-job filesystem/process residue;
- burst test grows from zero to the planned beta concurrency target;
- randomized termination tests kill instances at every lifecycle phase;
- cluster-disconnect tests prove queued work remains consistent;
- image revocation exercise blocks claims and rotates bootstrap keys;
- network tests attempt metadata, lateral, private-control-plane, and tenant access;
- cost model reconciles provider invoices to runner usage within the agreed tolerance.

## Exit criteria

- Static, Kubernetes, and managed Linux providers pass one conformance suite.
- No runner becomes ready without verified identity, image, and health state.
- Hardened runners are destroyed after every attempt.
- Capacity decisions are replayable and bounded by quotas and budgets.
- A region/AZ capacity impairment degrades predictably without corrupting run state.
- Operators can revoke an image or pool and stop new work within the security target.
- BYOC installation, upgrade, diagnostics, and removal are documented and tested.
