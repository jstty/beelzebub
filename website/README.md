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

## GitHub Actions deployment

Pull requests into `master` run the full test matrix and coverage gate. CI creates
or updates one PR comment with the statement, branch, function, and line coverage
summary. After those checks pass, same-repository PRs deploy the validated site
artifact to an expiring Firebase preview channel and receive the preview URL
through the Firebase action's PR comment. Firebase credentials are deliberately
unavailable to forked and Dependabot pull requests, so preview deployment is
skipped for those PRs.

After CI succeeds for a push to `master`, the production workflow checks out that
exact tested commit, downloads its validated site artifact, and deploys it to the
Firebase `live` channel for `beelzebub.io`.

Both Firebase deployment jobs require a repository Actions secret named
`FIREBASE_SERVICE_ACCOUNT_BEELZEBUB_IO`. Store the JSON key for a service account
authorized to deploy Firebase Hosting to the `beelzebub-io` project. Do not add
the JSON file to the repository. See the
[Firebase Hosting GitHub integration guide](https://firebase.google.com/docs/hosting/github-integration)
for service-account setup. The repository's `production` GitHub environment can
optionally be configured with required reviewers before live deployments.
