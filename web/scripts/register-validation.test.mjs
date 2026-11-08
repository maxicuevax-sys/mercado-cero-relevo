import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRegistration } from '../src/lib/auth/register-validation.ts';

test('normalizes name/email without changing the password', () => {
  const result = validateRegistration({ name: '  Ana López  ', email: ' ana@example.test ', password: '  Mi prueba larga  ' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.values, { name: 'Ana López', email: 'ana@example.test', password: '  Mi prueba larga  ' });
});
test('identifies the first invalid field and accepts 12–128 character passwords', () => {
  const valid = { name: 'Ana', email: 'ana@example.test', password: 'x'.repeat(12) };
  assert.equal(validateRegistration({ ...valid, name: ' ' }).field, 'name');
  assert.equal(validateRegistration({ ...valid, name: 'x'.repeat(81) }).field, 'name');
  assert.equal(validateRegistration({ ...valid, email: 'no-es-correo' }).field, 'email');
  assert.equal(validateRegistration({ ...valid, password: 'x'.repeat(11) }).field, 'password');
  assert.equal(validateRegistration({ ...valid, password: 'x'.repeat(129) }).field, 'password');
  assert.equal(validateRegistration(valid).ok, true);
  assert.equal(validateRegistration({ ...valid, password: 'x'.repeat(128) }).ok, true);
});
