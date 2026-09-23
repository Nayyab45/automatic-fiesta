import { db } from '../../src/db.js';

// `db` (src/db.js) is a plain exported object -- `{ prepare(sql) { ... } }`
// backed by a real MySQL pool. Since ESM exports of an object share the same
// reference everywhere it's imported, swapping db.prepare here redirects
// every route file's queries too, with no mocking library and no real
// database required.

// Strict, ordered stub: each call to db.prepare(...) consumes the next entry
// in `responses`, regardless of the SQL text. Good for a single route call
// whose sequence of queries is fixed and known -- throws immediately (rather
// than hitting real MySQL) if the route issues a query nobody expected, which
// usually means the test's expected sequence is wrong or the route changed.
export function stubDbSequence(responses) {
  const original = db.prepare;
  let i = 0;
  db.prepare = (sql) => {
    const entry = responses[i];
    if (!entry) {
      throw new Error(`stubDbSequence: no response queued for call #${i + 1}: ${sql}`);
    }
    i += 1;
    return {
      get: async (...args) => (typeof entry.get === 'function' ? entry.get(...args) : entry.get ?? null),
      all: async (...args) => (typeof entry.all === 'function' ? entry.all(...args) : entry.all ?? []),
      run: async (...args) =>
        (typeof entry.run === 'function' ? entry.run(...args) : entry.run) ?? { lastInsertRowid: 0, changes: 0 },
    };
  };
  return () => {
    db.prepare = original;
  };
}

// Loose stub: every db.prepare(...) call gets the same canned handler,
// regardless of SQL or call count. Good for routes that fire an unpredictable
// or uninteresting number of near-identical queries (e.g. a cascading
// multi-table delete) where only "these calls happened without throwing"
// matters, not their exact sequence.
export function stubDbAlways({ get = null, all = [], run = { lastInsertRowid: 0, changes: 0 } } = {}) {
  const original = db.prepare;
  db.prepare = () => ({
    get: async (...args) => (typeof get === 'function' ? get(...args) : get),
    all: async (...args) => (typeof all === 'function' ? all(...args) : all),
    run: async (...args) => (typeof run === 'function' ? run(...args) : run),
  });
  return () => {
    db.prepare = original;
  };
}

// Keyed stub: each db.prepare(sql) call is matched against `rules` in order
// (a rule's `match` is a substring or RegExp tested against the SQL text),
// and the first match's { get, all, run } handles that call; unmatched calls
// fall back to `fallback`. Good for a route whose query *sequence* is long or
// incidental (e.g. a profile assembled from a dozen near-irrelevant lookups)
// but where one or two specific queries -- which ones ran, with what args --
// are what the test actually cares about, regardless of surrounding order.
// The returned restore function also carries `.calls`, the raw SQL text of
// every call made while the stub was active, for asserting a query did (or
// pointedly didn't) happen.
export function stubDbMatching(rules, fallback = { get: null, all: [], run: { lastInsertRowid: 0, changes: 0 } }) {
  const original = db.prepare;
  const calls = [];
  db.prepare = (sql) => {
    calls.push(sql);
    const rule = rules.find((r) => (typeof r.match === 'string' ? sql.includes(r.match) : r.match.test(sql)));
    const entry = rule ?? fallback;
    return {
      get: async (...args) => (typeof entry.get === 'function' ? entry.get(...args) : entry.get ?? null),
      all: async (...args) => (typeof entry.all === 'function' ? entry.all(...args) : entry.all ?? []),
      run: async (...args) =>
        (typeof entry.run === 'function' ? entry.run(...args) : entry.run) ?? { lastInsertRowid: 0, changes: 0 },
    };
  };
  const restore = () => {
    db.prepare = original;
  };
  restore.calls = calls;
  return restore;
}
