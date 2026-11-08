type RegistrationFields = { name: string; email: string; password: string };
type RegistrationValidation =
  | { ok: true; values: RegistrationFields }
  | { ok: false; field: keyof RegistrationFields; message: string };

export function validateRegistration(fields: RegistrationFields): RegistrationValidation {
  const name = fields.name.trim();
  const email = fields.email.trim();
  const password = fields.password;
  if (!name || name.length > 80) return { ok: false, field: "name", message: "Escribe tu nombre, de hasta 80 caracteres." };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, field: "email", message: "Escribe un correo electrónico válido." };
  return { ok: true, values: { name, email, password } };
}
