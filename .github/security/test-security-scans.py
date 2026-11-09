"""Exercise the actual image-identity shell step with synthetic Docker output.

No Docker daemon, images, credentials or network are used.
"""
import json
import os
from pathlib import Path
import subprocess
import shutil
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/security-scans.yml"


class ImageIdentityContract(unittest.TestCase):
    def run_step(self, metadata):
        text = WORKFLOW.read_text(encoding="utf-8")
        section = text.split("      - name: Build isolated candidate and verify compiled SHA\n", 1)[1]
        block = section.split("        run: |\n", 1)[1].split("      - name:", 1)[0]
        script = "\n".join(line[10:] if line.startswith("          ") else line for line in block.splitlines())
        prefix = r'''
git() { printf '%s' "$FIXTURE_SHA"; }
docker() {
  case "$1" in
    build|save) return 0 ;;
    image) printf '%s' 'sha256:synthetic-image' ;;
    run)
      case " $* " in *" --entrypoint node "*) ;; *) return 91 ;; esac
      while [ "$#" -gt 0 ] && [ "$1" != "-e" ]; do shift; done
      [ "$#" -gt 0 ] || return 92
      shift
      "$NODE_TEST_EXE" -e "$NODE_TEST_PRELUDE $1"
      ;;
    *) return 90 ;;
  esac
}
'''
        with tempfile.TemporaryDirectory(prefix="security-image-contract-") as temporary:
            env = {**os.environ, "RUNNER_TEMP": temporary.replace("\\", "/"),
                   "FIXTURE_SHA": "a" * 40, "FIXTURE_METADATA": metadata,
                   "NODE_TEST_EXE": (shutil.which("node") or "C:/Program Files/nodejs/node.exe").replace("\\", "/"),
                   "NODE_TEST_PRELUDE": 'require("node:fs").readFileSync=(p)=>{if(p!=="/app/.next/BUILD_SHA")throw Error("Unexpected read");return process.env.FIXTURE_METADATA;};'}
            bash = "C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else "bash"
            return subprocess.run([bash, "-c", prefix + script], env=env, text=True, capture_output=True)

    def test_build_metadata_json_matches_the_exact_commit(self):
        result = self.run_step(json.dumps({"sha": "a" * 40, "builtAt": "2026-11-09T00:00:00Z"}))
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_wrong_missing_or_malformed_identity_never_reaches_scan(self):
        for metadata in [json.dumps({"sha": "b" * 40}), "{}", "not-json"]:
            with self.subTest(metadata=metadata):
                self.assertNotEqual(self.run_step(metadata).returncode, 0)

    def test_fixture_exceptions_are_exact_immutable_fingerprints(self):
        lines = (ROOT / ".github/security/gitleaks-reviewed-fixtures.txt").read_text().splitlines()
        entries = [line for line in lines if line and not line.startswith("#")]
        self.assertEqual(len(entries), 6)
        self.assertEqual(len(set(entries)), 6)
        for entry in entries:
            self.assertRegex(entry, r"^[0-9a-f]{40}:[A-Za-z0-9_./-]+:generic-api-key:[1-9][0-9]*$")
            self.assertNotIn("*", entry)

    def test_runtime_contract_has_no_shell_or_mutable_base(self):
        dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn("FROM node:24.22.2-trixie-slim@sha256:0820eaa85e07d0490446dd01d14707e17e6108a36988cf374899cd057eb3812d AS dependencies", dockerfile)
        self.assertIn("FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:088a01637f22908632ba09018be2e0b516f2fa6f7869c191d29491139db43c78 AS runner", dockerfile)
        runtime = dockerfile.split(" AS runner", 1)[1]
        self.assertNotRegex(runtime, r"(?m)^RUN\s")
        self.assertIn("USER 1000:1000", runtime)
        self.assertIn("PATH=/nodejs/bin:", runtime)
        self.assertIn("ENTRYPOINT []", runtime)
        self.assertIn('CMD ["node", "server.js"]', runtime)
        health = runtime.split("HEALTHCHECK", 1)[1].replace("\\\n", " ").split("CMD ", 1)[1].splitlines()[0]
        command = json.loads(health.strip())
        self.assertEqual(command[:2], ["node", "-e"])
        self.assertIn("/api/health", command[2])
        self.assertNotIn("CMD-SHELL", runtime)
        for directory in ["/data", "/app/data", "/app/.next/cache"]:
            self.assertRegex(runtime, r"COPY --from=builder --chown=1000:1000 [^\n]+ " + directory.replace(".", r"\.") + r"(?:\n|$)")


if __name__ == "__main__":
    unittest.main()
