# Container runtime boundary

This candidate replaces the Bookworm runtime with a minimal, pinned Debian 13
Node runtime. It does not change business data or payment rules. Scanner gates
remain HIGH/CRITICAL, including unfixed issues; no CVE/VEX exclusions are added.

## Pinned inputs

- Builder: `node:24.22.2-trixie-slim@sha256:0820eaa85e07d0490446dd01d14707e17e6108a36988cf374899cd057eb3812d`.
- Runner: `gcr.io/distroless/nodejs24-debian13:nonroot@sha256:088a01637f22908632ba09018be2e0b516f2fa6f7869c191d29491139db43c78`.

Official registry metadata observed 2026-11-09 identifies Node 24.22.2 in both.
Distroless contains the Node binary at `/nodejs/bin/node`; the original PATH does
not include it. The Dockerfile explicitly supplies PATH and numeric UID/GID
`1000:1000`, preserving the existing data-volume and Compose user contract.

Sources: [Node builder](https://github.com/nodejs/docker-node/blob/main/24/trixie-slim/Dockerfile),
[Distroless Node](https://github.com/GoogleContainerTools/distroless/blob/main/nodejs/README.md),
[Distroless signing](https://github.com/GoogleContainerTools/distroless/blob/main/README.md#how-do-i-verify-distroless-images).
The lead cryptographically verified the runner index with Cosign 3.1.4, issuer
`https://accounts.google.com`, identity
`keyless@distroless.iam.gserviceaccount.com`, including claims, transparency log and
CA verification. Local lead evidence: `qa-runs/goal-full/distroless-cosign-verification.json`.
That signature verifies provenance; it does not establish zero vulnerabilities.

## Runtime behavior

The final stage has no shell, npm, npx, package manager or `RUN` instruction. Build
dependencies stay in the builder. Directories for `/data/backups`, `/app/data`
and `/app/.next/cache` are prepared in the builder and copied with numeric owner
1000:1000. Standalone Next files and deploy backup scripts keep the same paths.
`HOME=/tmp` avoids relying on a passwd entry for UID 1000; writable storage still
comes from the existing data/cache/tmp mounts and permissions.

The inherited Node entrypoint is cleared: image configuration is `ENTRYPOINT []`
and `CMD ["node", "server.js"]`. Existing Compose explicitly supplies
`entrypoint: ["node", "server.js"]` and `command: []`; there is no duplicate Node
argument. The healthcheck is exec-form `node -e ...`, never `CMD-SHELL`.
`docker exec <container> node ...` resolves via PATH. Shell-based operations such
as `docker exec ... sh` are intentionally unavailable; do not weaken validators
or substitute a shell to conceal misconfiguration.

Scanner CI reads `.next/BUILD_SHA` JSON with `--entrypoint node`, validates its
full hexadecimal `sha`, requires equality with the checked-out commit, and still
requires the Trivy archive report to match the actual built image ID. It does not
require `cat` or a shell inside the runtime image.

## Required evidence before promotion

Static contracts and synthetic shell/Node tests are preparation only. The lead
must build the image and run: exact SHA health, configured user/entrypoint/PATH,
in-memory `node:sqlite`, built-in fetch, Sharp image transform and a real Next
image response, guest/account flows, writable data/cache permissions, backup and
restore verification with the existing operational validators, and complete
Trivy image scanning. Do not claim this candidate is clean until actual scanning
finishes. No scanner threshold or unfixed-vulnerability treatment is relaxed.

Rollback uses the previous image/config while preserving current tenant data;
no historical database restore or host package changes are part of this change.
