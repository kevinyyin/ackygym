const LINK_CLASSES = 'font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400'

// "Select all / none" and "Select / Cancel" for a list driven by useSelection.
function SelectControls({ selection, ids }) {
  return (
    <>
      {selection.selectMode && (
        <button type="button" onClick={() => selection.toggleAll(ids)} className={LINK_CLASSES}>
          {selection.selectedIds.size === ids.length ? 'Select none' : 'Select all'}
        </button>
      )}
      <button type="button" onClick={selection.toggleMode} className={LINK_CLASSES}>
        {selection.selectMode ? 'Cancel' : 'Select'}
      </button>
    </>
  )
}

export default SelectControls
