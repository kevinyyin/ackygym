export function mlToBottles(ml, bottleSizeMl) {
  return ml / bottleSizeMl
}

// Rounded to 1 decimal and trimmed ("2" not "2.0"), since a bottle count is
// read at a glance rather than logged precisely like a raw ml amount.
export function formatBottles(ml, bottleSizeMl) {
  const bottles = Math.round(mlToBottles(ml, bottleSizeMl) * 10) / 10
  return String(bottles)
}
