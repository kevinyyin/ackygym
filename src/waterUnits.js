// Rounded to 1 decimal and trimmed ("2" not "2.0"), since a bottle count is
// read at a glance rather than logged precisely like a raw ml amount.
export function formatBottles(ml, bottleSizeMl) {
  return String(Math.round((ml / bottleSizeMl) * 10) / 10)
}
