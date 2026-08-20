// Epley formula: a lifter's estimated one-rep max from a submaximal set.
export function estimatedOneRepMax(weight, reps) {
  if (!weight || !reps) return 0
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}
