# Security, secrets, and OIDC

Status: implementation plan

Owners: security, identity, platform

Depends on: [architecture](01-system-architecture.md), [GitHub App](05-github-app-and-planner.md), [runner protocol](07-runner-agent-and-protocol.md)

## Outcome

Make untrusted code execution an explicit security boundary. A compromised job must not gain control-plane access, another tenant's data, reusable credentials, or more cloud authority than its exact run policy permits.

OIDC is the preferred cloud authentication model: a running job receives a short-lived signed identity token and exchanges it directly with a configured cloud or secrets provider. The job does not store a long-lived AWS, Azure, GCP, or Vault credential in bz.

## Security principles

- deny by default and grant per attempt;
- keep control-plane and runner trust domains separate;
- use short-lived, audience-bound, purpose-bound credentials;
- derive authorization server-side from immutable run context;
- treat workflow source, dependencies, runner image, and generated plan as supply-chain inputs;
- assume workflow code and pull-request code may be malicious;
- log security decisions without logging secrets;
- make privileged behavior visually and programmatically explicit;
- preserve tenant isolation even during retries, reconciliation, and incident handling.

## Threat model

### Protected assets

- GitHub App private key and installation tokens;
- user/session identities and organization membership;
- repository source and metadata;
- stored secrets and external-provider credentials;
- OIDC signing keys;
- run plans, logs, artifacts, caches, and audit events;
- scheduler and runner control credentials;
- billing/usage records;
- infrastructure accounts, images, and deployment pipeline.

### Adversaries

- malicious code in a fork pull request;
- compromised dependency or action compatibility shim;
- malicious repository collaborator;
- one tenant attempting cross-tenant access;
- compromised runner or runner image;
- leaked session, attempt, enrollment, or signed URL;
- cloud/network attacker with partial infrastructure access;
- privileged operator abusing access;
- accidental configuration that grants secrets to an unsafe trigger.

### Required boundaries

| Boundary | Enforcement |
| --- | --- |
| tenant to tenant | tenant-scoped identity, row authorization, object-key policy, negative tests |
| control plane to runners | outbound-only agent protocol, purpose credentials, no shared database/network trust |
| one attempt to another | lease fence, unique workspace, unique credentials, destruction/cleanup |
| trusted to untrusted event | server-derived trust class, secret/cache/environment policy |
| job to cloud | OIDC audience/subject/claims and cloud-side trust policy |
| operator to customer data | just-in-time access, approval, audit, minimization |

The threat model is updated for each privileged feature and reviewed before public beta and GA.

## Authentication and authorization

### Human identities

- authenticate initially through GitHub OAuth or GitHub App user authorization;
- map external identities to stable internal user IDs;
- synchronize organization and repository access from GitHub with bounded staleness;
- require recent reauthentication for security-sensitive operations;
- support enterprise SSO/SCIM later without changing internal principals;
- expire web sessions, rotate refresh material, and revoke all sessions on account compromise.

### Service identities

Every service has a workload identity with an allowlisted audience and endpoint set. Do not use a shared internal API key. Mutual TLS or cloud workload identity protects service-to-service calls; authorization still checks tenant/resource context.

### Authorization model

Principals:

- user;
- GitHub installation;
- internal service;
- runner instance;
- run attempt;
- automation/service account.

Resources:

- organization, installation, repository, environment, workflow, run, artifact, cache, secret, runner pool, billing account.

Roles begin with organization owner, admin, member, billing manager, repository maintainer, reader, and runner administrator. Sensitive actions also check resource policy and event trust, not only role.

Every authorization decision accepts:

```text
principal + action + resource + tenant + immutable run context + current policy generation
```

Repositories transferred between organizations are disabled until ownership and policy are reconciled.

## GitHub App security

- request the minimum permissions enumerated in the GitHub App plan;
- keep the private key in KMS-backed secret storage and rotate it with overlap;
- mint installation tokens just in time, scope repository access, and keep only in memory;
- validate webhook HMAC against raw request bytes before parsing;
- enforce body-size and content-type limits;
- persist delivery ID and payload digest to prevent conflicting replay;
- treat GitHub event fields as input, then refetch critical repository/ref state;
- never expose installation tokens to planner or runner jobs;
- audit permission changes and installation suspension.

## Secret model

### Resource schema

```ts
type SecretRecord = {
  secretId: string;
  tenantId: string;
  scope: "organization" | "repository" | "environment";
  scopeId: string;
  name: string;
  ciphertext: Uint8Array;
  wrappedDataKey: Uint8Array;
  kmsKeyVersion: string;
  policy: SecretPolicy;
  version: number;
  createdBy: string;
  createdAt: string;
  rotatedAt?: string;
};

type SecretPolicy = {
  allowedEvents: string[];
  protectedRefs?: string[];
  requiredEnvironment?: string;
  allowForkPullRequests: false;
  allowedWorkflowDigests?: string[];
};
```

Names and policy are searchable; plaintext is neither stored nor returned after creation.

### Envelope encryption

1. Generate a random data-encryption key per secret version.
2. Encrypt plaintext using an authenticated cipher with tenant, scope, name, and version as associated data.
3. Wrap the data key using the environment/region KMS key.
4. Store ciphertext, nonce/tag, wrapped key, KMS key version, and associated metadata.
5. Zero plaintext buffers as soon as practical.

Production services do not receive direct KMS decrypt permission broadly. A secrets broker validates attempt policy and performs narrowly scoped decrypt/re-encrypt delivery.

### Resolution precedence

Environment, repository, and organization scopes may define the same name. Resolution order is explicit:

```text
environment > repository > organization
```

Before resolving, the broker evaluates trigger trust, ref protection, environment approval, workflow digest, repository status, and organization policy. A denied secret is absent and produces a policy diagnostic; it never silently falls back to a less-specific value unless policy explicitly permits it.

### Delivery to jobs

1. Planner records required secret names but never values.
2. Scheduler resolves whether the job is eligible and records the policy generation.
3. Claimed attempt obtains a single-use secret grant bound to attempt ID, lease epoch, names, and expiry.
4. Runner redeems it over its authenticated channel.
5. Broker returns values encrypted to the runner session, preferably as memory-backed files.
6. Agent registers exact and safely derived mask patterns before starting user code.
7. Values are deleted at attempt termination and grant reuse is rejected.

Avoid environment variables by default because child processes and debug tools commonly expose them. The SDK can expose file/handle-based access and offer environment injection only as an explicit compatibility option.

### Masking

Masking is defense in depth, not authorization.

- exact known values are replaced before sequence assignment and before persistence;
- support bounded encodings that are likely to appear (for example common base64 forms) without unbounded transformations;
- reject secrets too short to mask safely or mark them as unsafe for direct injection;
- mask across frame/chunk boundaries using a bounded streaming matcher;
- mask agent diagnostics and structured annotations too;
- do not show secret length or equality through UI diagnostics;
- continuously test deliberate split, encoding, shell tracing, and error-message leakage.

### Fork policy

Fork pull-request jobs receive no stored secrets and cannot use protected environments. Maintainer approval to execute does not automatically grant secrets; a distinct, explicit policy is required, and initial releases keep this prohibited.

### External secret providers

Vault/cloud secret manager integrations use OIDC federation or customer-installed broker identities. bz stores provider configuration and access policy, not the retrieved value. Provider reads are attempt-scoped and included in audit trails without recording plaintext.

## OIDC issuer

### Why OIDC

OIDC gives a job a signed, short-lived statement about who and what is running. A cloud provider validates the signature and claims, checks a customer-authored trust policy, and returns its own temporary credentials. Compromise is bounded by token lifetime, audience, subject, and cloud-side role policy.

### Public endpoints

- `GET /.well-known/openid-configuration`
- `GET /.well-known/jwks.json`
- `POST /v1/attempts/{id}/oidc/token`

Issuer URLs are environment-stable. Discovery and JWKS endpoints are cacheable, highly available, and served independently from the main application when practical.

### Claims

```json
{
  "iss": "https://token.bz.dev",
  "sub": "repo:acme/widget:ref:refs/heads/main:workflow:release:environment:prod",
  "aud": "sts.amazonaws.com",
  "iat": 1787500000,
  "nbf": 1787500000,
  "exp": 1787500600,
  "jti": "oidc_...",
  "bz_tenant_id": "org_...",
  "bz_repository_id": "repo_...",
  "bz_repository": "acme/widget",
  "bz_run_id": "run_...",
  "bz_job_id": "job_...",
  "bz_attempt_id": "attempt_...",
  "bz_workflow": "release",
  "bz_workflow_digest": "sha256:...",
  "bz_event": "push",
  "bz_ref": "refs/heads/main",
  "bz_sha": "...",
  "bz_environment": "prod",
  "bz_runner_environment": "managed",
  "bz_source_trust": "protected"
}
```

Exact names and subject grammar are versioned before beta. Claims come from immutable control-plane records, never runner-supplied strings.

### Token issuance

1. Workflow declares OIDC permission and a literal or policy-approved audience.
2. Attempt requests a token using the current attempt credential and lease fence.
3. Authorization checks job permission, event/ref/environment policy, attempt state, audience allowlist, and rate limit.
4. Issuer creates a unique token with a short lifetime (target 5–10 minutes, never beyond attempt authorization).
5. Issuance is audited using token ID and claim hashes, excluding the raw token.
6. Token is returned once over the encrypted agent channel.

Do not allow arbitrary runtime claims. Custom claims, if introduced, must be derived from reviewed plan literals and namespaced.

### Keys and rotation

- signing occurs through KMS/HSM or a tightly isolated signer;
- publish active and retiring public keys in JWKS;
- introduce a new key, wait for JWKS cache propagation, then sign with it;
- retain the old public key longer than the maximum token lifetime plus cache skew;
- rotate on a fixed schedule and immediately after suspected compromise;
- monitor unknown `kid`, signing errors, issuance spikes, and verification failures;
- maintain an emergency issuer-disable switch by tenant, repository, environment, and globally.

JWT revocation is not generally instantaneous at cloud providers. Short expiry, disabled future issuance, runner termination, and cloud-side session duration are the primary controls. Incident docs must say this plainly.

### Provider recipes

Ship generated trust-policy examples for:

- AWS IAM role web identity with exact issuer, audience, organization/repository, ref, workflow digest, and environment conditions;
- Google Cloud Workload Identity Federation attribute mappings and conditions;
- Azure federated identity credentials with supported subject patterns;
- HashiCorp Vault JWT auth roles.

The CLI has `bz oidc policy generate` and `bz oidc policy verify`. Verification decodes a locally supplied token or planned claims, evaluates the recipe offline, and warns about wildcard subjects or audiences.

## Audit system

Security-relevant actions emit immutable, append-only audit events:

```text
event_id, occurred_at, tenant_id, actor_type, actor_id,
action, resource_type, resource_id, outcome, reason_code,
source_ip_class, user_agent_class, request_id, metadata_digest
```

Audit includes role/policy changes, secret create/update/delete/use, OIDC issuance, environment approval, runner enrollment/revocation, artifact grants, GitHub installation changes, operator access, and security configuration changes.

Customer-visible audit export supports pagination and signed delivery. Internal audit storage has restricted access, retention, integrity monitoring, and a documented clock source.

## Platform hardening

### Network

- separate public ingress, control plane, data plane, and runner networks/accounts;
- block runner access to private services and metadata;
- use TLS everywhere and modern cipher policy;
- apply WAF/rate limits to webhooks, auth, and public APIs;
- egress allowlists for services that do not need general internet;
- private database/cache endpoints with no public route.

### Application

- parameterized queries and tenant-aware repository layer;
- schema validation and request size limits;
- CSRF protection for browser mutations and secure cookie settings;
- content security policy and output escaping;
- SSRF-safe URL retrieval with DNS/IP revalidation;
- idempotency and replay controls on all security mutations;
- dependency, secret, SAST, container, and IaC scanning in CI.

### Supply chain

- lock dependencies and verify package integrity;
- generate SBOMs for services and runner images;
- sign build artifacts and images with provenance;
- pin production deployment artifacts by digest;
- require review for workflow compiler, identity, signer, secret broker, and runner boundary changes;
- maintain emergency dependency/image revocation paths.

## Incident response

Runbooks cover:

- leaked GitHub App key;
- OIDC signing-key compromise;
- cross-tenant authorization defect;
- secret exposure in logs/artifacts/cache;
- malicious or compromised runner image;
- stolen runner/attempt credential;
- dependency or deployment compromise;
- unauthorized operator access.

Each runbook specifies detection, containment, credential/key rotation, workload cancellation, evidence preservation, customer notification decision, recovery, and post-incident tests. Conduct a table-top exercise before beta and a technical rotation drill before GA.

## Work packages

### SEC-01: threat model and security invariants

- map data flows and attack trees;
- assign owners and verification tests to every boundary;
- establish review gates for privileged features.

Done when security and engineering sign off the beta threat model.

### SEC-02: identity and authorization library

- define principals/actions/resources/context;
- implement deny-by-default policy evaluation and tenant-scoped data access;
- create cross-tenant and stale-membership tests.

Done when all service endpoints use one reviewed authorization contract.

### SEC-03: encrypted secrets service

- implement envelope encryption, versioning, scope/policy resolution, grants, and broker delivery;
- integrate KMS key lifecycle and audit;
- run masking/leakage adversarial suite.

Done when plaintext is absent from databases, queues, general logs, and API reads.

### SEC-04: OIDC issuer

- freeze issuer, claims, subject grammar, audience policy, signer, discovery, and JWKS;
- implement attempt-bound issuance and audit;
- test AWS, GCP, Azure, and Vault recipes.

Done when customers can obtain cloud credentials without storing a cloud secret in bz.

### SEC-05: runner isolation assessment

- test network, metadata, process, filesystem, container, credential, and cleanup boundaries;
- validate hardened/public-fork policy;
- establish recurring image conformance evidence.

Done when untrusted workload launch receives security approval.

### SEC-06: audit and operator access

- implement append-only audit events, customer export, integrity controls, and just-in-time support access;
- alert on sensitive access and policy changes;
- document retention and privacy.

Done when all enumerated actions are attributable and queryable.

### SEC-07: security response readiness

- implement global and scoped kill switches;
- create rotation/revocation automation and runbooks;
- perform table-top, restore, and key-compromise drills.

Done when drill findings are closed or explicitly accepted before GA.

## Verification gates

- tenant authorization property tests and endpoint fuzzing;
- fork, ref, environment, and workflow-digest secret-policy matrix;
- log masking across process/frame/chunk boundaries and common encodings;
- replay of enrollment, attempt, secret grant, OIDC, and signed URL credentials;
- expired, wrong-audience, wrong-subject, retired-key, and clock-skew OIDC tests;
- cloud trust-policy tests that prove forbidden repositories/refs cannot assume roles;
- SSRF, archive, dependency, container escape, and metadata endpoint tests;
- image SBOM/vulnerability/provenance gates;
- external penetration test before GA and after material boundary changes.

## Exit criteria

- Every request is attributable to a typed principal and tenant.
- Untrusted fork jobs cannot receive stored secrets, protected environments, or privileged cache writes.
- Job credentials are attempt-scoped, short-lived, audience/purpose-bound, and replay-resistant.
- OIDC tokens contain immutable server-derived claims and cloud recipes pass negative tests.
- Signing, GitHub App, data-encryption, and bootstrap keys have tested rotation procedures.
- Cross-tenant, compromised-runner, and leak scenarios have automated tests and incident runbooks.
- Security can stop issuance and scheduling at global, tenant, repository, environment, pool, and image scope.
