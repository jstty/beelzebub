# bz CI platform roadmap

The bz CI service roadmap and implementation plans have moved to the dedicated
[`jstty/bzci.ai`](https://github.com/jstty/bzci.ai) repository:

- [Platform roadmap](https://github.com/jstty/bzci.ai/blob/main/plans/bz-ci-platform-roadmap.md)
- [Detailed implementation suite](https://github.com/jstty/bzci.ai/blob/main/plans/bz-ci/README.md)
- [Dogfood-first delivery program](https://github.com/jstty/bzci.ai/blob/main/plans/bz-ci/13-delivery-program.md#dogfood-first-delivery-lane)

This `beelzebub` repository continues to own the v2 task engine and the planned public
`beelzebub/workflow` SDK, simulator/testkit additions, GitHub bridge, and local authoring CLI. The
`bzci.ai` repository owns the service/control plane, UI, runner protocol and agents, infrastructure,
data plane, identity/OIDC, subscriptions, billing, and operations.
