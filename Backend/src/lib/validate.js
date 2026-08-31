export function requireFields(body, fields) {
  const missing = fields.filter((field) => body?.[field] === undefined || body[field] === null || body[field] === '');
  return missing.length ? `${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required` : null;
}

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isOneOf(value, options) {
  return options.includes(value);
}

const PASSWORD_MIN_LENGTH = 8;

// Kept as one function (rather than a regex alone) so the specific failure
// reason can be reported back -- "needs a number" is more actionable than a
// generic "invalid password" for something the user typed themselves.
export function passwordStrengthError(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/\d/.test(password)) {
    return 'Password must include at least one number';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one special character';
  }
  return null;
}
