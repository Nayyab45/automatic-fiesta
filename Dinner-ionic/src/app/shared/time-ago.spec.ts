import { timeAgo } from './time-ago';

function isoSecondsAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

describe('timeAgo', () => {
  it('reports timestamps under a minute old as "Just now"', () => {
    expect(timeAgo(isoSecondsAgo(30))).toBe('Just now');
  });

  it('reports minutes for timestamps under an hour old', () => {
    expect(timeAgo(isoSecondsAgo(5 * 60))).toBe('5m ago');
  });

  it('reports hours for timestamps under a day old', () => {
    expect(timeAgo(isoSecondsAgo(3 * 60 * 60))).toBe('3h ago');
  });

  it('reports "Yesterday" for a timestamp exactly one day old', () => {
    expect(timeAgo(isoSecondsAgo(24 * 60 * 60 + 60))).toBe('Yesterday');
  });

  it('reports days for timestamps under a week old', () => {
    expect(timeAgo(isoSecondsAgo(3 * 24 * 60 * 60))).toBe('3d ago');
  });

  it('falls back to a short date for timestamps a week or older', () => {
    const result = timeAgo(isoSecondsAgo(10 * 24 * 60 * 60));
    expect(result).not.toContain('ago');
    expect(result).not.toBe('Yesterday');
  });

  it('parses SQLite\'s space-separated datetime format as UTC', () => {
    // A SQLite-style "YYYY-MM-DD HH:MM:SS" timestamp with no timezone
    // suffix. If timeAgo ever stops treating it as UTC, this drifts by
    // the local machine's UTC offset instead of reading as "just now".
    const now = new Date();
    const sqliteNow = now.toISOString().slice(0, 19).replace('T', ' ');
    expect(timeAgo(sqliteNow)).toBe('Just now');
  });
});
