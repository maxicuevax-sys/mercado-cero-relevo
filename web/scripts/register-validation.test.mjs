import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRegistration } from '../src/lib/auth/register-validation.ts';

test('normalizes name/email without changing the password', () => {
  const result = validateRegistration({ name: '  Ana López  ', email: ' ana@example.test ', password: '  Mi prueba larga  ' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.values, { name: 'Ana López', email: 'ana@example.test', password: '  Mi prueba larga  ' });
});
test('identifies invalid name/email while accepting demo passwords of any length', () => {
  const valid = { name: 'Ana', email: 'ana@example.test', password: 'x'.repeat(12) };
  assert.equal(validateRegistration({ ...valid, name: ' ' }).field, 'name');
  assert.equal(validateRegistration({ ...valid, name: 'x'.repeat(81) }).field, 'name');
  assert.equal(validateRegistration({ ...valid, email: 'no-es-correo' }).field, 'email');
  for (const password of ['', 'a', 'x'.repeat(129), 'x'.repeat(1024)]) {
    const result = validateRegistration({ ...valid, password });
    assert.equal(result.ok, true);
    assert.equal(result.values.password, password);
  }
});
