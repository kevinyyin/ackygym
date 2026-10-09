import Model from 'react-body-highlighter'

// Maps our muscle_groups.name values onto react-body-highlighter's Muscle slugs.
// One of our names may fan out to multiple slugs (e.g. "shoulders" has no single
// equivalent, since the package splits front/back deltoids).
const MUSCLE_SLUG_MAP = {
  chest: ['chest'],
  back: ['upper-back'],
  traps: ['trapezius'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  abs: ['abs'],
  obliques: ['obliques'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves'],
  adductors: ['adductor'],
  abductors: ['abductors'],
  lower_back: ['lower-back'],
  neck: ['neck'],
  // "lats" has no react-body-highlighter equivalent — left unmapped on purpose
  // rather than folded into another region.
}

// CSS var() references so the diagram reacts to the light/dark theme toggle live.
const PRIMARY_COLOR = 'var(--color-blue-500)'
const SECONDARY_COLOR = 'color-mix(in oklab, var(--color-blue-500) 45%, transparent)'
const BODY_COLOR = 'var(--color-line)'

function buildData(muscles) {
  const primarySlugs = new Set()
  const secondarySlugs = new Set()

  for (const m of muscles || []) {
    const slugs = MUSCLE_SLUG_MAP[m.muscle]
    if (!slugs) continue
    const bucket = m.role === 'primary' ? primarySlugs : secondarySlugs
    for (const slug of slugs) bucket.add(slug)
  }

  const data = []
  if (primarySlugs.size > 0) {
    data.push({ name: 'primary', muscles: [...primarySlugs], frequency: 2 })
  }
  if (secondarySlugs.size > 0) {
    data.push({ name: 'secondary', muscles: [...secondarySlugs], frequency: 1 })
  }
  return data
}

function BodyView({ label, type, data }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <p className="font-mono text-[10px] tracking-[0.15em] text-chalk-dim uppercase">{label}</p>
      <Model
        data={data}
        type={type}
        bodyColor={BODY_COLOR}
        highlightedColors={[SECONDARY_COLOR, PRIMARY_COLOR]}
        style={{ width: '100%', maxWidth: '140px' }}
      />
    </div>
  )
}

function MuscleBodyMap({ muscles }) {
  const data = buildData(muscles)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <BodyView label="Front" type="anterior" data={data} />
        <BodyView label="Back" type="posterior" data={data} />
      </div>
      <div className="flex items-center justify-center gap-4">
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-chalk-dim uppercase">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          Primary
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-chalk-dim uppercase">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500/45" />
          Secondary
        </span>
      </div>
    </div>
  )
}

export default MuscleBodyMap
