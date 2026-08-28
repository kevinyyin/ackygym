import Card from './Card'
import { TOGGLEABLE_CARDS } from './cardVisibility'

function SettingsModal({ open, visibility, onToggle, onClose }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-ink/80 p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl leading-none tracking-tight text-chalk uppercase">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-chalk-dim hover:text-danger"
          >
            ✕
          </button>
        </div>

        <p className="mt-4 text-[11px] font-semibold tracking-[0.2em] text-chalk-dim uppercase">
          Visible cards
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {TOGGLEABLE_CARDS.map((card) => (
            <label
              key={card.key}
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-4 py-3"
            >
              <span className="text-sm text-chalk">{card.label}</span>
              <input
                type="checkbox"
                checked={visibility[card.key]}
                onChange={() => onToggle(card.key)}
                className="h-5 w-5 accent-blue-500"
              />
            </label>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default SettingsModal
