# Beelzebub website

The Beelzebub 2.0 product site is a dependency-free static site served by Firebase Hosting.

- Source: `website/src`
- Generated output: `website/dist`
- API reference: generated from `docs/site` and mounted at `/api`
- Firebase project: `beelzebub-io`

Use `npm run site:build` to generate the complete site and `npm run site:serve` to
preview the generated output. The repository's normal CI uploads that output as
the `website-static` artifact.

With the Firebase CLI installed and authenticated, use `npm run site:preview` to
publish the `v2-preview` channel in the `beelzebub-io` project.

Production deployment uses `npm run site:deploy`. It replaces the live content currently served at `beelzebub.io`, so publish only after reviewing a preview.
