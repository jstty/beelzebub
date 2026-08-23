# Workflow SDK and intermediate representation

## Outcome

Provide a typed authoring API that produces a deterministic, serializable workflow plan. The same
plan must drive local simulation, the GitHub bridge, and the independent scheduler.

## Design boundary

The distributed workflow API describes jobs. The existing bz task engine implements what happens
inside one job.

```text
defineWorkflow() -> serializable job DAG -> server/local scheduler
BzTasks methods  -> runner-local tasks   -> existing task engine
```

This avoids serializing arbitrary closures and preserves ordinary TypeScript for task behavior.

## Public package surface

Proposed package: `beelzebub/workflow` initially, with the option to split into
`@beelzebub/workflow` later.

```ts
import {
  context,
  defineWorkflow,
  expr,
  job,
  linux,
  matrix,
  minutes,
  secret,
  service
} from 'beelzebub/workflow';
```

Required exports:

- `defineWorkflow(definition)`
- `job(definition)`
- `linux()`, with reserved future constructors for `windows()` and `macos()`
- `service(definition)`
- typed event constructors and context references
- typed expression constructors
- duration and byte-size constructors
- workflow-plan validation and canonical serialization
- public IR types without planner or service implementation dependencies

## Authoring contract

### Workflow definition

```ts
interface WorkflowDefinition {
  id?: string;
  name: string;
  on: TriggerDefinition;
  permissions?: PermissionDefinition;
  concurrency?: ConcurrencyDefinition;
  defaults?: WorkflowDefaults;
  jobs: Record<string, JobDefinition>;
}
```

Rules:

- Object keys are author-facing identifiers unless an explicit `id` is supplied.
- IDs match `^[A-Za-z][A-Za-z0-9_-]{0,63}$`.
- Display names may change without changing stable job identity.
- Definitions contain no cyclic JavaScript objects.
- Unknown keys fail validation in strict mode.

### Trigger definition

Initial triggers:

```ts
interface TriggerDefinition {
  push?: PushTrigger;
  pullRequest?: PullRequestTrigger;
  mergeGroup?: MergeGroupTrigger;
  schedule?: ScheduleTrigger[];
  manual?: ManualTrigger;
  api?: ApiTrigger;
}
```

Push filters:

- included and excluded branches;
- included and excluded tags;
- included and excluded paths;
- deletion behavior;
- default-branch-only helper.

Pull request filters:

- actions such as opened, synchronize, reopened, ready-for-review, and converted-to-draft;
- base branches;
- changed paths;
- draft policy;
- fork trust remains runtime context, not a static trigger claim.

Schedule:

- five-field UTC cron in v1;
- stable schedule identifier;
- optional input values;
- missed-schedule policy: skip, catch up once, or catch up all within a maximum window.

Manual and API triggers:

- typed string, boolean, number, choice, and environment inputs;
- default, required, validation, and sensitive-value flags;
- input schema included in IR and API/UI rendering.

### Job definition

```ts
interface JobDefinition {
  name?: Value<string>;
  needs?: string[];
  if?: Expression<boolean>;
  matrix?: MatrixDefinition;
  runner: RunnerRequirement;
  task: string;
  vars?: Record<string, Value<Serializable>>;
  permissions?: PermissionDefinition;
  environment?: Value<string> | EnvironmentDefinition;
  services?: Record<string, ServiceDefinition>;
  timeout?: Duration;
  queueTimeout?: Duration;
  retry?: RetryDefinition;
  continueOnError?: Value<boolean>;
  concurrency?: ConcurrencyDefinition;
  outputs?: Record<string, JobOutputDefinition>;
  artifacts?: ArtifactDeclaration[];
  cache?: CacheDeclaration[];
}
```

Job rules:

- `needs` refers only to jobs in the same workflow.
- The plan validator rejects cycles before a run is created.
- A job without `if` runs only when all required dependencies concluded successfully.
- `if` may inspect event context, inputs, matrix values, dependency results, and approved policy
  context; it may not call the network or filesystem.
- `continueOnError` changes downstream conclusion semantics but retains the original outcome.
- Retry creates a new attempt of the same expanded job.
- Job outputs are explicit and size limited.

### Runner requirements

```ts
interface RunnerRequirement {
  os: 'linux';
  architecture?: Value<'x64' | 'arm64'>;
  cpu?: Value<number>;
  memoryMiB?: Value<number>;
  diskMiB?: Value<number>;
  region?: Value<string>;
  pool?: Value<string>;
  capabilities?: Value<string>[];
  image?: Value<string>;
  nestedVirtualization?: Value<boolean>;
}
```

Validation applies platform maximums before matrix expansion. Policy may rewrite a generic
requirement to an approved runner class, but the effective requirement is stored with the run.

### Permissions

Initial repository permissions:

- contents;
- checks;
- pull requests;
- issues;
- packages;
- deployments;
- statuses;
- id token.

Values are `none`, `read`, or `write` where GitHub supports them. Default is `none` except the
minimum read permission required to fetch trusted source. Account and repository policy may reduce
permissions. A workflow cannot broaden the GitHub App installation grant.

### Services

Linux-only v1 services describe containers started beside a job:

```ts
interface ServiceDefinition {
  image: Value<string>;
  credentials?: SecretReference;
  env?: Record<string, Value<string | SecretReference>>;
  ports?: PortMapping[];
  volumes?: VolumeMount[];
  healthcheck?: HealthcheckDefinition;
  resources?: ResourceRequirement;
}
```

Service images should support digest pinning. The agent records resolved digests. Privileged
services require repository policy and a runner pool that advertises the capability.

## Expression system

### Why an AST is required

Server decisions must be reproducible and inspectable. JavaScript callbacks cannot be safely
serialized, evaluated across versions, or explained to users.

Expressions therefore build an immutable typed AST:

```ts
const shouldDeploy = expr.and(
  expr.eq(context.event.name, 'push'),
  expr.eq(context.ref, 'refs/heads/main'),
  expr.eq(context.repository.isFork, false)
);
```

### Initial value sources

- `context.event.*`
- `context.repository.*`
- `context.ref`, `context.sha`, `context.actor`
- `context.changedFiles`
- `context.trust.*`
- `inputs.*`
- `matrix.*`
- `needs.<job>.outcome|conclusion|outputs.*`
- `vars.*` for non-secret organization/repository values

Secret values are not expression inputs. Only `secret.available(name)` may expose a boolean after
policy evaluation.

### Initial operators

- equality and ordering;
- boolean and/or/not;
- string startsWith, endsWith, contains, and match against a bounded safe pattern engine;
- array contains and any/all over scalar arrays;
- null coalescing;
- string concatenation and format with bounded output;
- result helpers: success, failure, cancelled, skipped, always;
- changed-path matching using one documented glob implementation.

Every operator declares input and output types, null behavior, error behavior, and canonical JSON
encoding.

### Expression safety limits

- maximum nodes per expression;
- maximum total expression nodes per plan;
- maximum string and array size;
- no recursion, user functions, date/time reads, randomness, network, or regular-expression
  backtracking;
- deterministic Unicode and case behavior;
- evaluation step budget and structured diagnostic on exhaustion.

## Matrix model

Initial matrix features:

- Cartesian product of named axes;
- `include` rows that add or override values;
- `exclude` match objects;
- maximum parallelism;
- fail-fast policy;
- account/repository maximum expansion count;
- stable expanded job ID based on canonical axis order and values.

```ts
matrix({
  node: ['24.15.0', '26'],
  architecture: ['x64', 'arm64'],
  exclude: [{ node: '24.15.0', architecture: 'arm64' }],
  maxParallel: 3,
  failFast: false
});
```

Dynamic matrices derived from previous job output are deferred beyond the first vertical slice.
When added, the producing output must conform to a declared schema and expansion limit.

## WorkflowPlanV1

The planner emits data, not executable code.

```ts
interface WorkflowPlanV1 {
  apiVersion: 'bz.dev/workflow/v1';
  kind: 'WorkflowPlan';
  metadata: {
    workflowId: string;
    name: string;
    sourcePath: string;
    sourceSha: string;
    bzVersion: string;
    plannerVersion: string;
    generatedAt: string;
    planHash: string;
    policyHash: string;
  };
  triggers: PlannedTriggers;
  permissions: PlannedPermissions;
  concurrency?: PlannedConcurrency;
  jobs: Record<string, PlannedJob>;
  sourceMap: PlanSourceMap;
  diagnostics: PlanDiagnostic[];
}
```

Each `PlannedJob` contains normalized defaults, unresolved runtime expressions, dependency IDs,
matrix definition, runner requirements, task path, vars, permission request, environment, services,
retry, timeouts, declared outputs, artifacts, and caches.

### Canonicalization

1. Validate author input.
2. Apply SDK defaults.
3. Sort unordered maps by Unicode code point.
4. Preserve arrays whose order is semantic.
5. Normalize durations to milliseconds and sizes to bytes.
6. Normalize glob and expression representations.
7. Remove source locations and generated timestamp from the hash input.
8. Serialize with one canonical JSON implementation.
9. Hash using SHA-256 with a domain prefix and IR version.

The full stored plan retains source mapping and generation metadata; the semantic plan hash does
not change when only diagnostic line numbers change.

## Planning lifecycle

```text
resolve workflow file
 -> load pinned SDK/runtime
 -> evaluate defineWorkflow in sandbox
 -> capture author definition
 -> validate and normalize
 -> apply account/repository policy
 -> validate effective plan
 -> canonicalize and hash
 -> emit plan + diagnostics + source map
```

The local and remote planners call the same pure validation/canonicalization library after loading
repository code.

## Diagnostics

Every error contains:

- stable diagnostic code;
- severity;
- human-readable message;
- workflow/job/field path;
- source file, line, and column when known;
- related locations;
- safe suggested fix;
- documentation URL versioned with bz.

Initial codes include invalid ID, cycle, missing dependency, type mismatch, unknown context,
unbounded matrix, permission denied by policy, unsupported runner, invalid timeout, output schema
error, and unsupported IR feature.

## Implementation work packages

### SDK-01: IR types and schema

- Define serializable scalar and composite types.
- Define workflow, job, expression, trigger, matrix, runner, service, permission, and output IR.
- Generate JSON Schema from the source or verify hand-maintained schema parity.
- Add schema-version and feature-capability fields.

Done when all example plans validate in TypeScript and an independent JSON Schema validator.

### SDK-02: expression builder and evaluator

- Implement typed immutable nodes.
- Implement canonical serialization.
- Implement pure evaluator with step budget.
- Implement explanation trace that records operands and result without secrets.

Done when browser/local and server runtimes pass identical operator conformance vectors.

### SDK-03: workflow builders

- Implement workflow/job/runner/service builders.
- Preserve exact optional-property behavior.
- Attach source hints where JavaScript stack metadata safely permits it.
- Provide readable TypeScript errors and runtime diagnostics.

Done when representative workflows require no unsafe casts and autocomplete exposes supported
fields.

### SDK-04: validator and graph analyzer

- Validate IDs, references, cycles, limits, permissions, and feature support.
- Topologically sort jobs with stable tie breaking.
- Analyze unreachable jobs and ineffective conditions.
- Estimate maximum expanded jobs and requested resource-minutes.

Done when invalid graphs fail before execution and `bz explain` identifies the responsible field.

### SDK-05: canonicalizer and source map

- Normalize plan values.
- Produce stable hash fixtures.
- Map plan paths back to author source.
- Define hash migration behavior across versions.

Done when formatting, object insertion order, and non-semantic source changes do not alter the plan
hash.

### SDK-06: CLI planning tools

- `bz validate`
- `bz plan --json|--yaml`
- `bz graph --text|--mermaid|--json`
- `bz explain <job>`
- `bz simulate --event <file>`

Done when commands work without a bz account and produce machine-readable diagnostics.

### SDK-07: compatibility and migration

- Publish fixtures for every supported IR minor feature.
- Make new planner read old source API where promised.
- Make current scheduler accept prior supported IR.
- Add a compatibility matrix to release notes.

Done when an upgrade test runs the previous released planner/agent fixtures against the new
service.

## Test plan

### Unit tests

- Builder defaults and immutability.
- Expression type and null semantics.
- Glob behavior across Windows and POSIX path inputs.
- Matrix include/exclude and stable IDs.
- Permission intersection.
- Concurrency key length and normalization.

### Property tests

- Canonicalization idempotence.
- JSON round trip.
- Equivalent map insertion order yields one hash.
- Topological order respects dependencies.
- Matrix output contains no duplicate expanded IDs.
- Expression evaluation never exceeds declared resource bounds.

### Golden tests

- Current beelzebub CI topology.
- Monorepo matrix.
- Fork pull request.
- Deployment environment with approval.
- Services and artifacts.
- Continue-on-error and cleanup.
- Scheduled and manual inputs.

### Negative and fuzz tests

- Cycles and missing references.
- Prototype pollution keys.
- Huge/deep objects.
- Unicode confusables in identifiers.
- Unsafe pattern inputs.
- Unknown IR versions and features.
- Numeric overflow and invalid duration/size values.

## Rollout

1. Publish behind an experimental export and CLI flag.
2. Convert the repository CI definition without changing the existing GitHub scheduler.
3. Store golden `WorkflowPlanV1` fixtures in source control.
4. Stabilize author API only after three repository conversions.
5. Mark IR v1 stable before the independent scheduler consumes it in production.

## Exit criteria

- WorkflowPlanV1 schema and compatibility policy are accepted.
- The repository's complete CI topology is representable.
- Planning is deterministic across supported Node versions and operating systems.
- Local simulator and scheduler evaluator pass one conformance suite.
- Invalid graphs and policies produce source-located diagnostics.
- Maximum matrix and resource usage are known before a run queues.
- Existing runner-local `BzTasks` APIs remain compatible.
