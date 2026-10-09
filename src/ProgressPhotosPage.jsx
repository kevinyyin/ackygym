import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from './supabaseClient'
import Card from './Card'
import { displayName } from './displayName'
import { getTodayDateString, formatDate } from './dateUtils'
import { CameraIcon, CloseIcon } from './icons'
import ConfirmModal from './ConfirmModal'
import UndoToast from './UndoToast'
import { useDeferredDelete } from './useDeferredDelete'
import { smooth } from './motionPresets'
import Skeleton from './Skeleton'
import { useCachedState } from './pageCache'
import { useSelection } from './useSelection'
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
  const { isPending, message, stageDelete, undo } = useDeferredDelete('progress-photos')

  const profileByUserId = Object.fromEntries(profiles.map((p) => [p.id, p]))
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

  async function handleToggleShare(photo) {
    onError('')

    const { error } = await supabase
      .from('progress_photos')
      .update({ shared: !photo.shared })
      .eq('id', photo.id)

    if (error) {
      onError(error.message)
      return
    }

    setRefreshKey((k) => k + 1)
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

  async function handleBulkShare() {
    onError('')
    const { error } = await supabase
      .from('progress_photos')
      .update({ shared: true })
      .in('id', [...selectedPhotoIds])
      .eq('user_id', userId)

    if (error) {
      onError(error.message)
      return
    }

    selection.exit()
    setRefreshKey((k) => k + 1)
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
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-headline text-chalk">Progress photos</h2>
          <div className="flex shrink-0 items-center gap-3">
            {ownPhotoIds.length > 0 && <SelectControls selection={selection} ids={ownPhotoIds} />}
            <label className="cursor-pointer rounded-md bg-blue-500 px-4 py-2 font-body text-sm font-bold text-onblue active:bg-blue-600">
              {uploading ? 'Uploading…' : 'Add photo'}
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>
        <p className="mt-2 text-xs text-chalk-dim">
          Private by default — share individual photos to let others see them.
        </p>
      </Card>

      {!photosLoaded ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">Loading</span>
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : visiblePhotos.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-chalk-dim">No progress photos yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visiblePhotos.map((photo) => {
            const isOwn = photo.user_id === userId
            return (
              <Card key={photo.id} className="overflow-hidden">
                <div className="relative aspect-square bg-surface-2">
                  {signedUrlByPath[photo.path] ? (
                    <img
                      src={signedUrlByPath[photo.path]}
                      alt={`Progress photo from ${formatDate(photo.date, { year: true })}`}
                      onClick={() =>
                        isOwn && selectMode ? selection.toggle(photo.id) : setViewingPhoto(photo)
                      }
                      className={`h-full w-full cursor-pointer object-cover ${
                        selectMode && selectedPhotoIds.has(photo.id) ? 'opacity-50' : ''
                      }`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-chalk-dim">
                      <CameraIcon className="h-6 w-6" />
                    </div>
                  )}
                  {isOwn && !selectMode && (
                    <button
                      onClick={() => handleToggleShare(photo)}
                      aria-label={photo.shared ? 'Stop sharing photo' : 'Share photo'}
                      className={`absolute top-2 left-2 rounded-full px-2 py-1 font-mono text-[10px] font-semibold tracking-wide uppercase backdrop-blur ${
                        photo.shared ? 'bg-blue-500 text-onblue' : 'bg-ink/70 text-chalk-dim'
                      }`}
                    >
                      {photo.shared ? 'Shared' : 'Share'}
                    </button>
                  )}
                  {isOwn && !selectMode && (
                    <button
                      type="button"
                      onClick={() => setPhotoToDelete(photo)}
                      aria-label={`Delete photo from ${formatDate(photo.date, { year: true })}`}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-chalk backdrop-blur hover:text-danger"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  )}
                  {isOwn && selectMode && (
                    <input
                      type="checkbox"
                      checked={selectedPhotoIds.has(photo.id)}
                      onChange={() => selection.toggle(photo.id)}
                      aria-label={`Select photo from ${formatDate(photo.date, { year: true })}`}
                      className="absolute top-2 right-2 h-5 w-5 accent-blue-500"
                    />
                  )}
                </div>
                <p className="px-3 py-2 text-center font-mono text-xs text-chalk-dim">
                  {captionFor(photo, userId, profileByUserId)}
                </p>
              </Card>
            )
          })}
        </div>
      )}

      {selectMode && selectedPhotoIds.size > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleBulkShare}
            className="flex-1 rounded-md border border-line px-4 py-2 font-body text-sm font-semibold text-chalk-dim active:border-blue-500 active:text-blue-400"
          >
            Share {selectedPhotoIds.size} selected
          </button>
          <button
            type="button"
            onClick={() => setConfirmBulkDelete(true)}
            className="flex-1 rounded-md border border-danger px-4 py-2 font-body text-sm font-bold text-danger active:bg-danger/10"
          >
            Delete {selectedPhotoIds.size} selected
          </button>
        </div>
      )}

      <AnimatePresence>
        {viewingPhoto && (
          <motion.div
            key="lightbox"
            onClick={() => setViewingPhoto(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={smooth}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/95 p-4"
          >
            <button
              onClick={() => setViewingPhoto(null)}
              aria-label="Close"
              className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-chalk backdrop-blur active:text-danger"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            {signedUrlByPath[viewingPhoto.path] && (
              <img
                src={signedUrlByPath[viewingPhoto.path]}
                alt={`Progress photo from ${formatDate(viewingPhoto.date, { year: true })}`}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[85vh] max-w-[95vw] object-contain"
              />
            )}
            <p className="font-mono text-xs text-chalk-dim">
              {captionFor(viewingPhoto, userId, profileByUserId)}
            </p>
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
