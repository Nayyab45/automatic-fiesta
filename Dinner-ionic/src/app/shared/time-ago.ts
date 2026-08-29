/** Formats an ISO/SQLite `datetime('now')` timestamp as a short relative label. */
export function timeAgo(isoDate: string): string {
  // SQLite's datetime('now') has no timezone suffix but is UTC; Date needs
  // the 'Z' explicitly or it parses as local time and skews every value.
  const date = new Date(isoDate.includes('T') ? isoDate : `${isoDate.replace(' ', 'T')}Z`);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? 'Yesterday' : `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
