// dining_tables.date_time is stored as a naive 'YYYY-MM-DDTHH:mm' wall-clock
// string (see schema/tables.js) -- what a user typed into the date/time
// pickers on Create Table, in Pakistan Standard Time (UTC+5, no DST; the
// app has no other timezone to worry about). Comparing it directly against
// `new Date().toISOString()` (always UTC, with seconds/millis and a
// trailing "Z") was previously assumed to "sort/compare lexicographically
// the same as chronologically" -- that's only true if both strings are in
// the same timezone, and these aren't: it's off by the 5-hour PKT offset,
// so any table within ~5h of "now" in either direction got the wrong
// isPast/upcoming answer (e.g. a table 17 minutes in the past still
// counted as upcoming). This produces "now", in the same naive
// 'YYYY-MM-DDTHH:mm' shape and timezone as what's stored, so plain string
// comparison against date_time is actually correct.
export function nowAsTableTimeString() {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function isTablePast(dateTime) {
  return dateTime < nowAsTableTimeString();
}
