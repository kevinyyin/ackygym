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
              ? 'rounded-full bg-blue-500/20 px-2 py-0.5 font-mono text-[10px] tracking-wide text-blue-300 uppercase'
              : 'rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] tracking-wide text-chalk-dim uppercase'
          }
        >
          {m.label}
        </span>
      ))}
    </div>
  )
}

export default MuscleTags
