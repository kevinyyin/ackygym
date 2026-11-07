import { sortMuscleGroups } from './muscleGroupOrder'

function MuscleTags({ muscles }) {
  if (!muscles || muscles.length === 0) return null

  const sorted = sortMuscleGroups(
    muscles.map((m) => ({ name: m.muscle, role: m.role, label: m.muscle_groups?.label ?? m.muscle }))
  )

  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((m) => (
        <span
          key={m.name}
          className={
            m.role === 'primary'
              ? 'rounded-full bg-blue-500/15 px-2.5 py-0.5 text-caption font-medium text-blue-400'
              : 'rounded-full bg-surface-2 px-2.5 py-0.5 text-caption text-chalk-dim'
          }
        >
          {m.label}
        </span>
      ))}
    </div>
  )
}

export default MuscleTags
