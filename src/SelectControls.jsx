const LINK_CLASSES = 'h-11 shrink-0 rounded-full px-2 text-[15px] font-semibold text-blue-400 active:text-blue-300'

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
