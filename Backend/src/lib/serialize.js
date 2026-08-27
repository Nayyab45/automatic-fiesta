function toCamelKey(key) {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export function toCamel(row) {
  if (row == null) return row;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    result[toCamelKey(key)] = value;
  }
  return result;
}

export function toCamelRows(rows) {
  return rows.map(toCamel);
}
