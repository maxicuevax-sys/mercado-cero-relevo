# Security scanner CI

Prepared 2026-11-09. Configuration and static validation are not a successful scan.
The first actual `security-scans` run must pass all three jobs before its results
can be used as release evidence. A finding or scanner/database error fails the job.

## Scope and trust

- Gitleaks scans all fetched git history (`fetch-depth: 0`, `--all`), using built-in
  rules. No baseline, repository allowlist, `.gitleaksignore`, or inline suppression
  is trusted. Candidate metadata is logged; secret matches, source, author/email,
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
  Gitleaks has no network. Trivy has network for the official vulnerability DB;
  cache is fresh per job. Raw reports/logs stay in runner temporary storage.
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
