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
