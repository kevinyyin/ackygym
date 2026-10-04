import { useState } from 'react'
import Sheet from './Sheet'
import { supabase } from './supabaseClient'
import { TOGGLEABLE_CARDS } from './cardVisibility'
import ConfirmDeleteButton from './ConfirmDeleteButton'
import SegmentedControl from './SegmentedControl'
import { REST_PRESETS } from './autoRestSettings'

const WATER_MODES = [
  { key: 'volume', label: 'Volume' },
  { key: 'bottles', label: 'Bottles' },
]

const WEIGHT_UNITS = ['kg', 'lb']

function SettingsModal({
  open,
  visibility,
  onToggle,
  waterSettings,
  onWaterSettingsChange,
  weightUnit,
  onWeightUnitChange,
  autoRest,
  onAutoRestChange,
  restDuration,
  onRestDurationChange,
  onClose,
  profile,
  userId,
  onProfileSaved,
  onError,
  theme,
  onThemeChange,
}) {
  const [username, setUsername] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState('')
  const [bottleSizeInput, setBottleSizeInput] = useState(String(waterSettings.bottleSizeMl))
  const [goalInput, setGoalInput] = useState(String(waterSettings.goalMl))
  const [wasOpen, setWasOpen] = useState(open)

  // Re-seed the inputs from current values each time the modal opens (state
  // adjustment during render, per React's guidance — not an effect — since
  // this component stays mounted and just returns null while closed).
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setUsername(profile?.username ?? '')
      setUsernameStatus('')
      setBottleSizeInput(String(waterSettings.bottleSizeMl))
      setGoalInput(String(waterSettings.goalMl))
    }
  }

  function handleBottleSizeChange(value) {
    setBottleSizeInput(value)
    const numeric = Number(value)
    if (value !== '' && Number.isFinite(numeric) && numeric > 0) {
      onWaterSettingsChange({ bottleSizeMl: numeric })
    }
  }

  function handleGoalChange(value) {
    setGoalInput(value)
    const numeric = Number(value)
    if (value !== '' && Number.isFinite(numeric) && numeric > 0) {
      onWaterSettingsChange({ goalMl: numeric })
    }
  }

  async function handleSaveUsername() {
    const trimmed = username.trim()
    if (!trimmed || trimmed === (profile?.username ?? '')) {
      setUsernameStatus('No changes to save.')
      return
    }

    onError('')
    setUsernameStatus('')
    setSavingUsername(true)
    const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', userId)
    setSavingUsername(false)

    if (error) {
      onError(error.code === '23505' ? 'That username is already taken.' : error.message)
      return
    }
    setUsernameStatus('Saved.')
    onProfileSaved()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Settings" size="large">
      <h3 className="text-headline">Appearance</h3>
      <div className="mt-3">
        <SegmentedControl
          layoutId="settings-theme"
          value={theme}
          onChange={onThemeChange}
          segments={[
            { key: 'dark', label: 'Dark' },
            { key: 'light', label: 'Light' },
          ]}
        />
      </div>

      <p className="mt-8 text-[11px] font-[550] tracking-[0.2em] text-chalk-dim uppercase">
        Username
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            setUsernameStatus('')
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSaveUsername()}
          placeholder="Set a username"
          className="w-full min-w-0 rounded-md border border-line bg-surface-2 px-3 py-2 font-body text-sm text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSaveUsername}
          disabled={savingUsername}
          className="shrink-0 rounded-md bg-blue-500 px-3 py-2 font-body text-sm font-bold text-onblue active:bg-blue-600 disabled:opacity-50"
        >
          {savingUsername ? 'Saving…' : 'Save'}
        </button>
      </div>
      {usernameStatus && <p className="mt-1.5 text-xs text-chalk-dim">{usernameStatus}</p>}

      <p className="mt-5 text-[11px] font-[550] tracking-[0.2em] text-chalk-dim uppercase">
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

      <p className="mt-5 text-[11px] font-[550] tracking-[0.2em] text-chalk-dim uppercase">
        Weight unit
      </p>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-4 py-3">
        <span className="text-sm text-chalk">Display as</span>
        <div className="inline-flex rounded-full border border-line bg-surface p-0.5">
          {WEIGHT_UNITS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onWeightUnitChange(option)}
              className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${
                weightUnit === option ? 'bg-blue-500 text-onblue' : 'text-chalk-dim'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <h3 className="mt-8 text-headline">Workout</h3>
      <label className="mt-3 flex items-center justify-between gap-3 rounded-field bg-surface-2 px-4 py-3.5">
        <span className="text-[15px] text-chalk">
          Auto-start rest after logging a set
        </span>
        <input
          type="checkbox"
          checked={autoRest}
          onChange={(e) => onAutoRestChange(e.target.checked)}
          className="h-5 w-5 accent-blue-500"
        />
      </label>
      <label className="mt-2 flex items-center justify-between gap-3 rounded-field bg-surface-2 px-4 py-3.5">
        <span className="text-[15px] text-chalk">Rest length</span>
        <select
          value={restDuration}
          onChange={(e) => onRestDurationChange(Number(e.target.value))}
          className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-chalk focus:border-blue-500 focus:outline-none"
        >
          {/* A custom length set from the timer sheet isn't a preset — keep it selectable. */}
          {!REST_PRESETS.some((p) => p.seconds === restDuration) && (
            <option value={restDuration}>{restDuration}s</option>
          )}
          {REST_PRESETS.map((p) => (
            <option key={p.seconds} value={p.seconds}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <p className="mt-5 text-[11px] font-[550] tracking-[0.2em] text-chalk-dim uppercase">
        Water tracking
      </p>
      <p className="mt-1 text-xs text-chalk-dim">
        Show your water totals as a raw amount, or as a count of bottles of a size you set.
      </p>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-4 py-3">
        <span className="text-sm text-chalk">Display as</span>
        <div className="inline-flex rounded-full border border-line bg-surface p-0.5">
          {WATER_MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              onClick={() => onWaterSettingsChange({ mode: mode.key })}
              className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${
                waterSettings.mode === mode.key ? 'bg-blue-500 text-onblue' : 'text-chalk-dim'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-4 py-3">
        <label htmlFor="water-goal" className="text-sm text-chalk">
          Daily goal (mL)
        </label>
        <input
          id="water-goal"
          type="number"
          min="1"
          value={goalInput}
          onChange={(e) => handleGoalChange(e.target.value)}
          className="w-24 rounded-md border border-line bg-surface px-2 py-1.5 text-right font-mono text-sm text-chalk focus:border-blue-500 focus:outline-none"
        />
      </div>
      {waterSettings.mode === 'bottles' && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-4 py-3">
          <label htmlFor="water-bottle-size" className="text-sm text-chalk">
            Bottle size (mL)
          </label>
          <input
            id="water-bottle-size"
            type="number"
            min="1"
            value={bottleSizeInput}
            onChange={(e) => handleBottleSizeChange(e.target.value)}
            className="w-24 rounded-md border border-line bg-surface px-2 py-1.5 text-right font-mono text-sm text-chalk focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      <ConfirmDeleteButton
        onConfirm={() => supabase.auth.signOut()}
        idleLabel="Sign out"
        armedLabel="Tap again to sign out"
        children="Sign out"
        armedChildren="Tap again to sign out"
        danger={false}
        className="mt-5 w-full rounded-md border px-4 py-2.5 font-body text-sm font-semibold"
        idleClassName="border-line text-chalk-dim active:border-blue-500 active:text-blue-400"
        armedClassName="border-blue-500"
      />
    </Sheet>
  )
}

export default SettingsModal
