"""Linux Bash contract tests. No daemon, remote host, or production data is used."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

HOOK = Path(__file__).with_name('backup-judges.sh')

ENGINE = r'''#!/usr/bin/env python3
import json, os, pathlib, shutil, sys
args=sys.argv[1:]; root=pathlib.Path(os.environ['FIXTURE_ROOT'])
with (root/'calls.jsonl').open('a') as log: log.write(json.dumps(args)+'\n')
image='sha256:'+'a'*64
if args[0]=='inspect':
    field=args[2]
    if 'Config.Env' in field:
        env=['JUDGE_DEMO_ACCOUNTS=true','DEMO_MODE=true','JUDGE_DATA_ROOT=/data/judges','PILOT_AUTH_SECRET=PRIVATE-TEST-SECRET','OPENAI_API_KEY=']
        if os.environ.get('BAD_ENV'): env.append('PEY_API_KEY=test-provider-blocked')
        print(json.dumps(env))
    elif 'Running' in field: print('false' if os.environ.get('DOWN') else 'true')
    else: print(image)
elif args[0]=='exec':
    if 'snapshot' in args:
        if os.environ.get('CAPTURE_FAIL'): sys.exit(1)
        (root/'captured').write_text('yes')
    elif any('rmSync' in arg for arg in args):
        if os.environ.get('CLEANUP_FAIL'): sys.exit(1)
        (root/'cleaned').write_text(args[-1])
elif args[0]=='cp':
    if os.environ.get('CP_FAIL'): sys.exit(1)
    dest=pathlib.Path(args[-1]); (dest/'manifest.json').write_text('{"fixture":true}')
    if os.environ.get('CP_LINK'): (dest/'unsafe').symlink_to(root/'external')
elif args[0]=='run':
    if image not in args: sys.exit(7)
    code=args[-1]
    if 'verifySnapshot' in code:
        if os.environ.get('VERIFY_FAIL'): sys.exit(1)
        print(json.dumps({'accounts':2,'captured':1}))
    else: print('// fixture runtime judge-snapshot.mjs')
else: sys.exit(9)
'''


@unittest.skipUnless(os.name == 'posix' and shutil.which('bash') and shutil.which('flock'),
                     'Requires Linux/POSIX Bash and flock; Windows is explicitly skipped.')
class JudgeBackupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / 'pilot'
        self.root.mkdir()
        self.bin = Path(self.tmp.name) / 'bin'
        self.bin.mkdir()
        for name in ('docker', 'podman'):
            engine = self.bin / name
            engine.write_text(ENGINE)
            engine.chmod(0o700)
        self.env = dict(os.environ, PATH=str(self.bin)+os.pathsep+os.environ['PATH'],
                        MC_PILOT_ROOT=str(self.root), FIXTURE_ROOT=str(self.root))

    def configure(self, text=None):
        (self.root/'judge-backup.env').write_text(text or
            'JUDGE_BACKUP_ENGINE=docker\nJUDGE_BACKUP_CONTAINER=mercado-cero-judges\nJUDGE_BACKUP_DATA_ROOT=/data/judges\n')

    def run_hook(self, args=(), **env):
        return subprocess.run(['bash', str(HOOK), *args], env=dict(self.env, **env),
                              text=True, capture_output=True, timeout=15)

    def calls(self):
        p = self.root/'calls.jsonl'
        return [json.loads(x) for x in p.read_text().splitlines()] if p.exists() else []

    def previous(self):
        stage=self.root/'backup-current'
        for name in ('judges','judge-tools'):
            (stage/name).mkdir(parents=True)
            (stage/name/'old').write_text('previous verified publication')
        return stage

    def assert_preserved(self, stage):
        for name in ('judges','judge-tools'):
            self.assertEqual((stage/name/'old').read_text(),'previous verified publication')
        self.assertEqual(list(stage.glob('.judges-incoming.*')), [])

    def test_optional_absent_has_no_side_effects(self):
        p=self.root/'legacy'; p.write_text('legacy')
        result=self.run_hook()
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(result.stdout,'')
        self.assertEqual(sorted(x.name for x in self.root.iterdir()),['legacy'])

    def test_config_never_evaluated(self):
        self.configure('JUDGE_BACKUP_ENGINE=$(touch '+str(self.root/'executed')+')\n')
        result=self.run_hook()
        self.assertNotEqual(result.returncode,0)
        self.assertFalse((self.root/'executed').exists())
        self.assertEqual(self.calls(),[])

    def test_invalid_config(self):
        for text in [
            'JUDGE_BACKUP_ENGINE=docker\nJUDGE_BACKUP_CONTAINER=other\nJUDGE_BACKUP_DATA_ROOT=/data/judges\n',
            'JUDGE_BACKUP_ENGINE=docker\nJUDGE_BACKUP_CONTAINER=mercado-cero-x\nJUDGE_BACKUP_DATA_ROOT=/data\n',
            'UNKNOWN=value\n',
            'JUDGE_BACKUP_ENGINE=docker\nJUDGE_BACKUP_ENGINE=podman\n',
        ]:
            with self.subTest(text=text):
                self.configure(text)
                self.assertNotEqual(self.run_hook().returncode,0)
        self.assertEqual(self.calls(),[])

    def test_happy_capture_private_metadata_and_immutable_validator(self):
        self.configure(); stage=self.previous()
        result=self.run_hook()
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('verified and published',result.stdout)
        self.assertNotIn('PRIVATE',result.stdout+result.stderr)
        tools=stage/'judge-tools'
        self.assertIn('PRIVATE-TEST-SECRET',(tools/'runtime-env.json').read_text())
        self.assertEqual((tools/'runtime-env.json').stat().st_mode & 0o777,0o600)
        capture=json.loads((tools/'capture.json').read_text())
        self.assertEqual(capture['accounts'],2)
        self.assertEqual(capture['captured'],1)
        self.assertNotIn('PRIVATE',(tools/'capture.json').read_text())
        self.assertTrue((tools/'SHA256SUMS').is_file())
        self.assertFalse((stage/'judges'/'runtime-env.json').exists())
        runs=[c for c in self.calls() if c[0]=='run']
        self.assertEqual(len(runs),2)
        for args in runs:
            self.assertIn('sha256:'+'a'*64,args)
            for flag,value in [('--network','none'),('--user','0'),('--cap-drop','ALL'),('--memory','256m'),('--memory-swap','256m'),('--cpus','.25')]:
                self.assertEqual(args[args.index(flag)+1],value)
            self.assertIn('--read-only',args)
        validator=next(c for c in runs if 'verifySnapshot' in c[-1])
        self.assertIn('dst=/snapshot,readonly',validator[validator.index('--mount')+1])
        cleaned=(self.root/'cleaned').read_text()
        self.assertRegex(cleaned,r'^/data/judge-backups/auto-\d{8}T\d{6}Z-[A-Za-z0-9]{12}$')
        self.assertEqual(list(stage.glob('.judges-incoming.*')),[])

    def test_failed_verification_preserves_previous_publication(self):
        self.configure(); stage=self.previous()
        result=self.run_hook(VERIFY_FAIL='1')
        self.assertNotEqual(result.returncode,0)
        self.assertNotIn('verified and published',result.stdout)
        self.assert_preserved(stage)

    def test_missing_down_or_provider_never_report_success(self):
        self.configure(); stage=self.previous()
        for flag in ('DOWN','BAD_ENV','CAPTURE_FAIL','CP_FAIL'):
            with self.subTest(flag=flag):
                result=self.run_hook(**{flag:'1'})
                self.assertNotEqual(result.returncode,0)
                self.assertNotIn('verified and published',result.stdout)
                self.assertNotIn('PRIVATE',result.stdout+result.stderr)
                self.assert_preserved(stage)

    def test_symlink_config_rejected_without_engine(self):
        outside=Path(self.tmp.name)/'outside'; outside.write_text('secret')
        (self.root/'judge-backup.env').symlink_to(outside)
        self.assertNotEqual(self.run_hook().returncode,0)
        self.assertEqual(self.calls(),[])
        self.assertEqual(outside.read_text(),'secret')

    def test_symlink_stage_rejected_without_touching_target(self):
        self.configure()
        outside=Path(self.tmp.name)/'outside'; outside.mkdir()
        (outside/'keep').write_text('keep')
        (self.root/'backup-current').symlink_to(outside,target_is_directory=True)
        self.assertNotEqual(self.run_hook().returncode,0)
        self.assertEqual((outside/'keep').read_text(),'keep')
        self.assertEqual(self.calls(),[])

    def test_untrusted_copy_link_never_deleted_or_published(self):
        self.configure(); stage=self.previous()
        external=self.root/'external'; external.write_text('keep')
        result=self.run_hook(CP_LINK='1')
        self.assertNotEqual(result.returncode,0)
        self.assertNotIn('verified and published',result.stdout)
        self.assertEqual(external.read_text(),'keep')
        self.assertTrue((stage/'judges'/'old').is_file())
        # Refuse recursive cleanup of a tree with unvalidated links: leave for private inspection.
        self.assertEqual(len(list(stage.glob('.judges-incoming.*'))),1)


    def test_cleanup_failure_never_reports_success(self):
        self.configure()
        result=self.run_hook(CLEANUP_FAIL='1')
        self.assertNotEqual(result.returncode,0)
        self.assertNotIn('verified and published',result.stdout)
        self.assertIn('no success recorded',result.stderr)

    def test_concurrent_lock_rejected_without_engine(self):
        import fcntl
        self.configure()
        with (self.root/'.judge-backup.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result=self.run_hook()
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(self.calls(),[])
        self.assertNotIn('verified and published',result.stdout)

    def test_second_publication_failure_rolls_back_first(self):
        self.configure()
        stage=self.root/'backup-current'
        (stage/'judges').mkdir(parents=True)
        (stage/'judges'/'old').write_text('previous verified publication')
        (stage/'judge-tools').write_text('blocked second destination')
        result=self.run_hook()
        self.assertNotEqual(result.returncode,0)
        self.assertNotIn('verified and published',result.stdout)
        self.assertEqual((stage/'judges'/'old').read_text(),'previous verified publication')
        self.assertEqual((stage/'judge-tools').read_text(),'blocked second destination')
        self.assertEqual(list(stage.glob('.judges-incoming.*')),[])


    def test_absent_config_after_publication_fails_closed(self):
        stage=self.previous()
        result=self.run_hook()
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(self.calls(),[])
        self.assert_preserved(stage)

    def test_absent_config_with_any_judge_artifact_fails_closed(self):
        for rel in ['backup-current/judges','backup-current/judge-tools','backup-current/config/judge-backup.env']:
            with self.subTest(rel=rel):
                p=self.root/rel; p.parent.mkdir(parents=True,exist_ok=True)
                p.symlink_to(self.root/'missing')
                result=self.run_hook()
                self.assertNotEqual(result.returncode,0)
                self.assertEqual(self.calls(),[])
                p.unlink()

    def test_main_lock_held_standalone_refuses(self):
        import fcntl
        self.configure()
        with (self.root/'.mercado-cero-backup.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result=self.run_hook()
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(self.calls(),[])
        self.assertFalse((self.root/'backup-current').exists())


    def test_parent_lock_inherited_description_allows_capture(self):
        self.configure()
        result=subprocess.run(['bash','-c',
            'exec 9>"$MC_PILOT_ROOT/.mercado-cero-backup.lock"; flock -n 9 || exit 1; bash "$1" --parent-lock-held',
            'parent-fixture',str(HOOK)],env=self.env,text=True,capture_output=True,timeout=15)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('verified and published',result.stdout)

    def test_parent_lock_flag_requires_inherited_fd(self):
        self.configure()
        result=self.run_hook(args=['--parent-lock-held'])
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(self.calls(),[])

    def test_unknown_arguments_fail(self):
        self.assertNotEqual(self.run_hook(args=['--unknown']).returncode,0)
        self.assertNotEqual(self.run_hook(args=['--parent-lock-held','extra']).returncode,0)

    def test_relative_root_rejected(self):
        self.assertNotEqual(self.run_hook(MC_PILOT_ROOT='relative').returncode,0)
        self.assertEqual(self.calls(),[])


if __name__ == '__main__':
    unittest.main()
