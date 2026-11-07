import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from './supabaseClient'
import Card from './Card'
import Button from './Button'
import { displayName } from './displayName'
import { getTodayDateString, formatDate } from './dateUtils'
import { CameraIcon, CheckIcon, CloseIcon, LockIcon, PeopleIcon, PlusIcon } from './icons'
import ConfirmModal from './ConfirmModal'
import UndoToast from './UndoToast'
import { useDeferredDelete } from './useDeferredDelete'
import { smooth } from './motionPresets'
import Skeleton from './Skeleton'
import { useCachedState } from './pageCache'
import { useSelection } from './useSelection'
import { useModalFocusTrap } from './useModalFocusTrap'
import SelectControls from './SelectControls'

const BUCKET = 'progress-photos'
const SIGNED_URL_TTL = 60 * 60
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

function captionFor(photo, userId, profileByUserId) {
  const isOwn = photo.user_id === userId
  return isOwn
    ? formatDate(photo.date, { year: true })
    : `${profileByUserId[photo.user_id] ? displayName(profileByUserId[photo.user_id]) : 'Shared'} · ${formatDate(photo.date, { year: true })}`
}

function ProgressPhotosPage({ profiles, userId, onError }) {
  const [photos, setPhotos] = useCachedState('photos:photos', [])
  const [photosLoaded, setPhotosLoaded] = useCachedState('photos:photosLoaded', false)
  const [signedUrlByPath, setSignedUrlByPath] = useState({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [viewingPhoto, setViewingPhoto] = useState(null)
  const [photoToDelete, setPhotoToDelete] = useState(null)
  const selection = useSelection()
  const { selectMode, selectedIds: selectedPhotoIds } = selection
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  // Ids waiting on the share confirmation; sharing a body photo is never one tap.
  const [photoIdsToShare, setPhotoIdsToShare] = useState(null)
  const { isPending, message, stageDelete, undo } = useDeferredDelete('progress-photos')
  const lightboxRef = useModalFocusTrap(viewingPhoto !== null)

  const profileByUserId = Object.fromEntries(profiles.map((p) => [p.id, p]))
  const otherNames = profiles.filter((p) => p.id !== userId).map(displayName)
  const audience =
    otherNames.length > 0
      ? new Intl.ListFormat(undefined, { type: 'conjunction' }).format(otherNames)
      : 'everyone else who joins Ackygym'
  const visiblePhotos = photos.filter((p) => !isPending(p.id))
  const ownPhotoIds = visiblePhotos.filter((p) => p.user_id === userId).map((p) => p.id)

  useEffect(() => {
    async function fetchPhotos() {
      const { data, error } = await supabase
        .from('progress_photos')
        .select('id, user_id, path, date, created_at, shared')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        onError(error.message)
        return
      }
      setPhotos(data)
      setPhotosLoaded(true)
    }

    fetchPhotos()
  }, [refreshKey, onError, setPhotos, setPhotosLoaded])

  useEffect(() => {
    if (photos.length === 0) return

    let cancelled = false

    async function fetchSignedUrls() {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(photos.map((p) => p.path), SIGNED_URL_TTL)

      if (error) {
        onError(error.message)
        return
      }
      if (cancelled) return

      const next = {}
      for (const entry of data) {
        if (entry.signedUrl) next[entry.path] = entry.signedUrl
      }
      setSignedUrlByPath(next)
    }

    fetchSignedUrls()

    return () => {
      cancelled = true
    }
  }, [photos, onError])

  useEffect(() => {
    if (!viewingPhoto) return

    function handleKeyDown(e) {
      if (e.key === 'Escape') setViewingPhoto(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewingPhoto])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      onError('Please choose an image file.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      onError('That image is too large — the limit is 15MB.')
      return
    }

    onError('')
    setUploading(true)

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
    const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
    if (uploadError) {
      onError(uploadError.message)
      setUploading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('progress_photos')
      .insert({ user_id: userId, path, date: getTodayDateString() })

    if (insertError) {
      onError(insertError.message)
      await supabase.storage.from(BUCKET).remove([path])
      setUploading(false)
      return
    }

    setUploading(false)
    setRefreshKey((k) => k + 1)
  }

  async function setShared(ids, shared) {
    onError('')
    const { error } = await supabase
      .from('progress_photos')
      .update({ shared })
      .in('id', ids)
      .eq('user_id', userId)

    if (error) {
      onError(error.message)
      return false
    }
    setRefreshKey((k) => k + 1)
    return true
  }

  async function handleConfirmShare() {
    const ids = photoIdsToShare
    setPhotoIdsToShare(null)
    if ((await setShared(ids, true)) && selectMode) selection.exit()
  }

  // Unsharing narrows who can see it, so it needs no confirmation.
  async function handleStopSharing(photo) {
    if (await setShared([photo.id], false)) {
      setViewingPhoto((current) => (current?.id === photo.id ? { ...current, shared: false } : current))
    }
  }

  // The confirm sheets sit below the lightbox, so it closes first.
  function openFromLightbox(action) {
    const photo = viewingPhoto
    setViewingPhoto(null)
    action(photo)
  }

  // Single and bulk deletes share one path: the files first, then the rows.
  function stagePhotoDelete(ids, paths, message) {
    stageDelete({
      ids,
      message,
      commit: async (isForeground) => {
        if (isForeground) onError('')

        const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths)
        if (removeError) {
          if (isForeground) onError(removeError.message)
          return
        }

        const { error: deleteError } = await supabase
          .from('progress_photos')
          .delete()
          .in('id', ids)
          .eq('user_id', userId)

        if (deleteError) {
          if (isForeground) onError(deleteError.message)
          return
        }

        setRefreshKey((k) => k + 1)
      },
    })
  }

  function handleDelete(photo) {
    setPhotoToDelete(null)
    stagePhotoDelete([photo.id], [photo.path], 'Photo deleted')
  }


  function handleBulkDelete() {
    const ids = [...selectedPhotoIds]
    const paths = photos.filter((p) => selectedPhotoIds.has(p.id)).map((p) => p.path)
    setConfirmBulkDelete(false)
    selection.exit()
    stagePhotoDelete(ids, paths, `${ids.length} photo${ids.length === 1 ? '' : 's'} deleted`)
  }

  return (
    <>
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <div className="-my-1.5 flex items-center justify-between gap-2">
          <h2 className="text-headline text-chalk">Progress photos</h2>
          {ownPhotoIds.length > 0 && (
            <div className="-mr-2 flex shrink-0 items-center">
              <SelectControls selection={selection} ids={ownPhotoIds} />
            </div>
          )}
        </div>
        <p className="text-caption text-chalk-dim">
          Private by default. Open a photo to share it with {audience}.
        </p>
        {/* A label, not a button, so the tap opens the picker natively; the
            input stays focusable (sr-only, not display:none) for keyboards. */}
        <label
          aria-disabled={uploading || undefined}
          className={`flex h-11 items-center justify-center gap-1.5 rounded-full bg-blue-500 text-[15px] font-semibold text-onblue focus-within:ring-2 focus-within:ring-blue-300 focus-within:ring-offset-2 focus-within:ring-offset-surface active:bg-blue-600 ${
            uploading ? 'opacity-40' : 'cursor-pointer'
          }`}
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          {uploading ? 'Uploading…' : 'Add photo'}
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            className="sr-only"
          />
        </label>
      </Card>

      {!photosLoaded ? (
        <div aria-busy="true" className="grid grid-cols-2 gap-3">
          <span className="sr-only">Loading</span>
          <Skeleton className="aspect-[4/5]" />
          <Skeleton className="aspect-[4/5]" />
        </div>
      ) : visiblePhotos.length === 0 ? (
        <Card className="p-4">
          <p className="text-[15px] text-chalk-dim">No progress photos yet. Add one to start comparing.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visiblePhotos.map((photo) => {
            const isOwn = photo.user_id === userId
            const dateLabel = formatDate(photo.date, { year: true })
            const selected = selectedPhotoIds.has(photo.id)
            const selecting = isOwn && selectMode
            return (
              <Card key={photo.id} className="overflow-hidden">
                <div className="relative aspect-square bg-surface-2">
                  {/* The photo itself is the open (or select) target, so it's a real button. */}
                  <button
                    type="button"
                    onClick={() => (selecting ? selection.toggle(photo.id) : setViewingPhoto(photo))}
                    aria-label={`${selecting ? 'Select' : 'View'} photo from ${dateLabel}${isOwn ? (photo.shared ? ', shared' : ', private') : ''}`}
                    aria-pressed={selecting ? selected : undefined}
                    className="absolute inset-0 flex items-center justify-center text-chalk-dim focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none focus-visible:ring-inset"
                  >
                    {signedUrlByPath[photo.path] ? (
                      <img
                        src={signedUrlByPath[photo.path]}
                        alt=""
                        className={`h-full w-full object-cover transition-opacity ${selecting && selected ? 'opacity-50' : ''}`}
                      />
                    ) : (
                      <CameraIcon className="h-6 w-6" />
                    )}
                  </button>
                  {/* State only: sharing and deleting live in the viewer, away from
                      the thumb that's reaching to open the photo. */}
                  {isOwn && (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur ${
                        photo.shared ? 'bg-blue-500 text-onblue' : 'bg-ink/70 text-chalk'
                      }`}
                    >
                      {photo.shared ? <PeopleIcon className="h-4 w-4" /> : <LockIcon className="h-3.5 w-3.5" />}
                    </span>
                  )}
                  {selecting && (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        selected ? 'border-blue-500 bg-blue-500 text-onblue' : 'border-white/80 bg-ink/40'
                      }`}
                    >
                      {selected && <CheckIcon className="h-4 w-4" />}
                    </span>
                  )}
                </div>
                <p className="truncate px-3 py-2 text-center text-caption text-chalk-dim">
                  {captionFor(photo, userId, profileByUserId)}
                </p>
              </Card>
            )
          })}
        </div>
      )}

      {selectMode && selectedPhotoIds.size > 0 && (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1 px-4 text-[15px]" onClick={() => setPhotoIdsToShare([...selectedPhotoIds])}>
            Share {selectedPhotoIds.size}
          </Button>
          <Button variant="destructive" className="flex-1 px-4 text-[15px]" onClick={() => setConfirmBulkDelete(true)}>
            Delete {selectedPhotoIds.size}
          </Button>
        </div>
      )}

      <AnimatePresence>
        {viewingPhoto && (
          <motion.div
            key="lightbox"
            ref={lightboxRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Photo from ${formatDate(viewingPhoto.date, { year: true })}`}
            tabIndex={-1}
            onClick={() => setViewingPhoto(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={smooth}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/95 px-4 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] focus:outline-none"
          >
            <button
              onClick={() => setViewingPhoto(null)}
              type="button"
              aria-label="Close"
              className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            {signedUrlByPath[viewingPhoto.path] && (
              <img
                src={signedUrlByPath[viewingPhoto.path]}
                alt={`Progress photo from ${formatDate(viewingPhoto.date, { year: true })}`}
                onClick={(e) => e.stopPropagation()}
                className="min-h-0 max-w-full flex-1 object-contain"
              />
            )}
            <p className="text-caption text-white/70">
              {captionFor(viewingPhoto, userId, profileByUserId)}
            </p>
            {viewingPhoto.user_id === userId && (
              <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-sm flex-col items-center gap-3">
                <p className="flex items-center gap-1.5 text-caption text-white/70">
                  {viewingPhoto.shared ? (
                    <>
                      <PeopleIcon className="h-4 w-4" aria-hidden="true" />
                      Shared with {audience}
                    </>
                  ) : (
                    <>
                      <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      Private. Only you can see it.
                    </>
                  )}
                </p>
                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      viewingPhoto.shared
                        ? handleStopSharing(viewingPhoto)
                        : openFromLightbox((photo) => setPhotoIdsToShare([photo.id]))
                    }
                    className="h-11 flex-1 rounded-full bg-white/15 text-[15px] font-semibold text-white active:bg-white/25"
                  >
                    {viewingPhoto.shared ? 'Stop sharing' : 'Share…'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openFromLightbox(setPhotoToDelete)}
                    className="h-11 flex-1 rounded-full bg-white/15 text-[15px] font-semibold text-white active:bg-white/25"
                  >
                    Delete…
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    <ConfirmModal
      open={photoToDelete !== null}
      title="Delete photo?"
      message={`This photo from ${photoToDelete ? formatDate(photoToDelete.date, { year: true }) : ''} will be permanently removed.`}
      onConfirm={() => handleDelete(photoToDelete)}
      onCancel={() => setPhotoToDelete(null)}
    />

    <ConfirmModal
      open={photoIdsToShare !== null}
      title={photoIdsToShare?.length > 1 ? `Share ${photoIdsToShare.length} photos?` : 'Share this photo?'}
      message={`${audience[0].toUpperCase()}${audience.slice(1)} will be able to see ${photoIdsToShare?.length > 1 ? 'them' : 'it'} on their Photos page. You can stop sharing at any time.`}
      confirmLabel="Share"
      confirmVariant="accent"
      onConfirm={handleConfirmShare}
      onCancel={() => setPhotoIdsToShare(null)}
    />

    <ConfirmModal
      open={confirmBulkDelete}
      title="Delete selected photos?"
      message={`${selectedPhotoIds.size} photo${selectedPhotoIds.size === 1 ? '' : 's'} will be permanently removed.`}
      onConfirm={handleBulkDelete}
      onCancel={() => setConfirmBulkDelete(false)}
    />

    <UndoToast message={message} onUndo={undo} />
    </>
  )
}

export default ProgressPhotosPage
