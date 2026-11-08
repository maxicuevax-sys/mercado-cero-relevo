"""Nonsecret runtime-target v1. Missing files retain the original public pilot.

Present malformed configuration fails closed. URLs are not configurable here.
"""
import json
from pathlib import Path
import re

DEFAULT_PATH = Path('/opt/mercado-cero/pilot/runtime-target.json')
LEGACY_SHA = '09b4f8d1aa63f40682e2e4082034fe952a1dd1e2'
LEGACY_TARGET = {'version': 1, 'buildSha': LEGACY_SHA, 'requireJudgeAccounts': False}


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate runtime target key')
        result[key] = value
    return result


def validate_runtime_target(value):
    if not isinstance(value, dict) or set(value) != set(LEGACY_TARGET):
        raise ValueError('Runtime target must contain exactly version, buildSha and requireJudgeAccounts')
    if type(value['version']) is not int or value['version'] != 1:
        raise ValueError('Unsupported runtime target version')
    if not isinstance(value['buildSha'], str) or not re.fullmatch(r'[0-9a-fA-F]{40}', value['buildSha']):
        raise ValueError('Runtime target buildSha must be a full 40-character hexadecimal SHA')
    if type(value['requireJudgeAccounts']) is not bool:
        raise ValueError('Runtime target requireJudgeAccounts must be boolean')
    return {**value, 'buildSha': value['buildSha'].lower()}


def load_runtime_target(path=DEFAULT_PATH):
    try:
        with Path(path).open(encoding='utf-8-sig') as source:
            text = source.read(4097)
    except FileNotFoundError:
        return dict(LEGACY_TARGET)
    if len(text) > 4096:
        raise ValueError('Runtime target exceeds size limit')
    return validate_runtime_target(json.loads(text, object_pairs_hook=_unique_object))


def verify_readiness(health, target, session_status=None):
    target = validate_runtime_target(target)
    if not isinstance(health, dict) or health.get('ok') is not True or health.get('buildSha') != target['buildSha']:
        raise ValueError('Origin health or application SHA mismatch')
    if target['requireJudgeAccounts'] and session_status != 401:
        raise ValueError('Judge account session endpoint is not ready (expected unauthenticated 401)')
