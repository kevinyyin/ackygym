export const TOGGLEABLE_CARDS = [
  { key: 'water', label: 'Water tracker' },
  { key: 'creatine', label: 'Creatine check' },
  { key: 'calorie', label: 'Calorie calculator' },
  { key: 'calorieTracker', label: 'Calorie tracker' },
]

export const DEFAULT_CARD_VISIBILITY = Object.fromEntries(TOGGLEABLE_CARDS.map((card) => [card.key, true]))
