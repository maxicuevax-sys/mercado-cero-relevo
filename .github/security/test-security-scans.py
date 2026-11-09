"""Exercise the actual image-identity shell step with synthetic Docker output.

No Docker daemon, images, credentials or network are used.
"""
import json
import os
from pathlib import Path
import subprocess
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
    run) printf '%s' "$FIXTURE_METADATA" ;;
    *) return 90 ;;
  esac
}
python3() { "$PYTHON_TEST_EXE" "$@"; }
'''
        with tempfile.TemporaryDirectory(prefix="security-image-contract-") as temporary:
            env = {**os.environ, "RUNNER_TEMP": temporary.replace("\\", "/"),
                   "FIXTURE_SHA": "a" * 40, "FIXTURE_METADATA": metadata,
                   "PYTHON_TEST_EXE": sys.executable.replace("\\", "/")}
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


if __name__ == "__main__":
    unittest.main()
