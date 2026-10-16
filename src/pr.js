// Feed sets in chronological order; returns whether each is a PR: a new
// heaviest weight, or more reps than ever before at a weight already lifted.
export function prTracker() {
  let maxWeight = null
  const bestRepsByWeight = new Map()
  return (weight, reps) => {
    const bestReps = bestRepsByWeight.get(weight)
    const isWeightPr = maxWeight === null || weight > maxWeight
    const isRepPr = bestReps !== undefined && reps > bestReps
    if (isWeightPr) maxWeight = weight
    if (bestReps === undefined || reps > bestReps) bestRepsByWeight.set(weight, reps)
    return isWeightPr || isRepPr
  }
}
