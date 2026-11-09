# Security scanner CI

Prepared 2026-11-09. Configuration and static validation are not a successful scan.
The first actual `security-scans` run must pass all three jobs before its results
can be used as release evidence. A finding or scanner/database error fails the job.

## Scope and trust

- Gitleaks scans all fetched git history (`fetch-depth: 0`, `--all`), using built-in
  rules and only the six individually reviewed immutable fingerprints documented
  below. No baseline, path/rule glob, arbitrary repository config, `.gitleaksignore`,
  or inline suppression is trusted. Candidate metadata is logged; secret matches, source, author/email,
  commit messages and raw reports are not published.
- Trivy scans repository dependencies (including npm development dependencies),
  then independently scans a newly built Docker image archive. HIGH and CRITICAL
  findings fail, including unfixed findings. It does not replace CodeQL,
  dependency review, push protection, or a review of lower-severity findings.
- The image job records the checked-out commit and Docker image ID, and verifies
  `.next/BUILD_SHA` before exporting that image. Trivy must report the same image
  ID. This is a CI build of the source SHA, **not proof that a separately built
  production image is byte-for-byte identical**. No registry publication/deploy.
- Scanners run on ephemeral GitHub-hosted Ubuntu runners, as the runner UID, with
  read-only roots, dropped capabilities and no new privileges. Source/archive
  mounts are read-only. No Docker socket, host HOME, credentials, production
  environment, Sentry upload token or GitHub token is mounted/passed to scanners.
  Every scan has no network. Trivy first downloads the official vulnerability DB
  in a separate container that has only a fresh cache mount, without checkout,
  image archive or reports. Offline scans then use that cache with DB updates
  disabled. Raw reports/logs stay in runner temporary storage.
- Only `contents: read` is requested. Checkout does not persist credentials.
  No `pull_request_target`, self-hosted runner, write permission, or PR comment.

## Executable pins and incident review

The official [Aqua incident conclusion](https://github.com/aquasecurity/trivy/discussions/10462)
documents the March 2026 compromise, including malicious release/action tags and
Docker Hub tags. This does not establish a present compromise of a later release.
We avoid the affected version family, mutable executable tags and composite
`trivy-action`/`setup-trivy` installers. Digest pinning fixes the reviewed bytes;
it is not a guarantee that those bytes are free of defects.

Verified read-only against official release/tag metadata and GHCR manifest
responses on 2026-11-09, without pulling or executing scanner images locally:

| Component | Release/source commit | Immutable reference |
|---|---|---|
| [Trivy v0.76.2](https://github.com/aquasecurity/trivy/releases/tag/v0.76.2), released Nov 5 | `3f6334d223b52188324af3b9923b4249cd206652` | `ghcr.io/aquasecurity/trivy@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb` |
| [Gitleaks v8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) | `83d9cd684c87d95d656c1458ef04895a7f1cbd8e` | `ghcr.io/gitleaks/gitleaks@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f` |
| [Checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) | `3d3c42e5aac5ba805825da76410c181273ba90b1` | action pinned to that full commit |

See the official [Gitleaks usage/configuration](https://github.com/gitleaks/gitleaks/blob/83d9cd684c87d95d656c1458ef04895a7f1cbd8e/README.md)
and [Trivy archive scanning](https://trivy.dev/docs/latest/target/container_image/).
Vulnerability data uses the official `ghcr.io/aquasecurity/trivy-db:2` schema tag;
unlike executable pins this intentionally updates. A DB download or schema failure
must never be counted as zero findings. Updating executable pins requires reviewing
the vendor's advisories, release/source identity and new registry digest together.

## Limits and first-run review

History can contain real past leaks or synthetic test fixtures. Review each finding
by rule/path/line/commit without printing the secret. Do not add a broad baseline
to make CI green. A confirmed real secret needs revocation/rotation, not merely
deletion from the current tree. This workflow neither rotates keys nor rewrites git.

Trivy only covers formats it recognizes. The workflow requires a result for
`web/package-lock.json` so skipped extraction cannot look successful; other
unrecognized manifests need separate coverage. Docker build uses the repository's
Dockerfile and current upstream base image; the actual built image ID is evidence.
Lower severities, runtime configuration, the deployed filesystem, and external
provider state remain outside this gate. Branch-protection requirements are a
separate maintainer decision after the checks have run successfully.

## First-run repair and reviewed historical fixtures

Run `42579939327` at source `8c863debcc5f6ee34500fadc73e1ae2d1a3edf83`
completed the real repository dependency scan successfully. The image build also
completed, but the workflow mistakenly compared the whole JSON `.next/BUILD_SHA`
file to a plain SHA. The repaired verifier parses the existing `{sha,builtAt}`
schema and still requires the exact checked-out SHA before archive scanning.
Its regression executes the actual shell step with synthetic Docker responses:
correct JSON passes; wrong/missing/malformed identity fails. No scanner/Docker
daemon is used by that regression. Actual image scanning still needs a new CI run.

Gitleaks reported six matches, reviewed individually in the immutable historical
source without printing `Secret` or `Match`. None is a live/provider credential:

| Commit | File and line | Reviewed purpose |
|---|---|---|
| `7e93dc129327343510fdb1dff9b12dda22f494e7` | `web/scripts/business-profile.test.mjs:58` | Password supplied to isolated synthetic identity registration |
| `785e96da2c66cd737a5a18656a5a409284821955` | `deploy/ops/validate-judge-release.py:66` | Constant validation error text passed to `require`, not an environment value |
| `785e96da2c66cd737a5a18656a5a409284821955` | `deploy/ops/validate-judge-release.py:117` | Constant validation error text passed to `require`, not an environment value |
| `989cb1cfe86616742e2cf0efea4b5a930572b14b` | `web/scripts/judge-browser/judge.spec.ts:7` | Password for synthetic localhost browser registrations |
| `f35f76c7bb0dc90b13e2dafd2f3eaaabd780084d` | `web/scripts/payment-truth-e2e.py:104` | Synthetic operator token for a temporary loopback test server |
| `dfb2b793d066cccc3af1fcb963753e3fc011a9b0` | `web/scripts/payment-truth-e2e.py:104` | Same synthetic loopback fixture in an earlier commit |

`.github/security/gitleaks-reviewed-fixtures.txt` records only each exact
`commit:path:rule:line` fingerprint. New commits, another line, or any other match
still fail. The workflow prints the reviewed count separately; it does not imply
the original history contained zero candidates. Expanding exceptions requires a
new individual source review, not an automated baseline or a suppressed rule.
