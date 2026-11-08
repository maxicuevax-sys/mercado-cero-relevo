"""Systemd readiness bridge; Docker owns restart policy, Coolify owns deployment."""
import json
import time
import urllib.error
import urllib.request

from runtime_target import DEFAULT_PATH, load_runtime_target, verify_readiness


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def check_once(target, opener=None):
    opener = opener or urllib.request.build_opener(NoRedirect())
    with opener.open('http://127.0.0.1:4590/api/health', timeout=2) as response:
        if response.code != 200:
            raise ValueError('Origin health HTTP status is not 200')
        health = json.load(response)
    status = None
    if target['requireJudgeAccounts']:
        try:
            response = opener.open('http://127.0.0.1:4590/api/access/session', timeout=2)
        except urllib.error.HTTPError as error:
            response = error
        try:
            status = response.code
        finally:
            response.close()
    verify_readiness(health, target, status)


def wait_for_app(target, attempts=30, check=check_once, sleep=time.sleep):
    for attempt in range(attempts):
        try:
            check(target)
            return True
        except (OSError, ValueError):
            if attempt + 1 < attempts:
                sleep(1)
    return False


def main():
    try:
        target = load_runtime_target(DEFAULT_PATH)
    except (OSError, ValueError):
        raise SystemExit('Invalid runtime target; application readiness refused.')
    if not wait_for_app(target):
        raise SystemExit('Active application did not become ready with the expected build and account mode.')
    print('Mercado Cero active build ready.')


if __name__ == '__main__':
    main()
