import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Card from './Card'
import { displayName } from './displayName'
import { getTodayDateString } from './dateUtils'
import { CameraIcon } from './icons'

const BUCKET = 'progress-photos'
const SIGNED_URL_TTL = 60 * 60

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function captionFor(photo, userId, profileByUserId) {
  const isOwn = photo.user_id === userId
  return isOwn
    ? formatDate(photo.date)
    : `${profileByUserId[photo.user_id] ? displayName(profileByUserId[photo.user_id]) : 'Shared'} · ${formatDate(photo.date)}`
}

function SectionLabel({ children }) {
  return (
    <h2 className="flex items-center gap-2 px-1 text-[11px] font-semibold tracking-[0.2em] text-chalk-dim uppercase">
      <span className="h-2.5 w-0.5 bg-blue-500" />
      {children}
    </h2>
  )
}

function ProgressPhotosPage({ profiles, userId, onError }) {
  const [photos, setPhotos] = useState([])
  const [signedUrlByPath, setSignedUrlByPath] = useState({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [viewingPhoto, setViewingPhoto] = useState(null)

  const profileByUserId = Object.fromEntries(profiles.map((p) => [p.id, p]))

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
    }

    fetchPhotos()
  }, [refreshKey, onError])

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

  async function handleDelete(photo) {
    onError('')

    const { error: removeError } = await supabase.storage.from(BUCKET).remove([photo.path])
    if (removeError) {
      onError(removeError.message)
      return
    }

    const { error: deleteError } = await supabase
      .from('progress_photos')
      .delete()
      .eq('id', photo.id)

    if (deleteError) {
      onError(deleteError.message)
      return
    }

    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Progress photos</SectionLabel>
          <label className="shrink-0 cursor-pointer rounded-md bg-blue-500 px-4 py-2 font-body text-sm font-bold text-onblue active:bg-blue-600">
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
        <p className="mt-2 text-xs text-chalk-dim">
          Private by default — share individual photos to let others see them.
        </p>
      </Card>

      {photos.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-chalk-dim">No progress photos yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo) => {
            const isOwn = photo.user_id === userId
            return (
              <Card key={photo.id} className="overflow-hidden">
                <div className="relative aspect-square bg-surface-2">
                  {signedUrlByPath[photo.path] ? (
                    <img
                      src={signedUrlByPath[photo.path]}
                      alt={`Progress photo from ${formatDate(photo.date)}`}
                      onClick={() => setViewingPhoto(photo)}
                      className="h-full w-full cursor-pointer object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-chalk-dim">
                      <CameraIcon className="h-6 w-6" />
                    </div>
                  )}
                  {isOwn && (
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
                  {isOwn && (
                    <button
                      onClick={() => handleDelete(photo)}
                      aria-label={`Delete photo from ${formatDate(photo.date)}`}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-chalk backdrop-blur active:text-danger"
                    >
                      ✕
                    </button>
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

      {viewingPhoto && (
        <div
          onClick={() => setViewingPhoto(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-ink/90 p-4"
        >
          <button
            onClick={() => setViewingPhoto(null)}
            aria-label="Close"
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-chalk backdrop-blur active:text-danger"
          >
            ✕
          </button>
          {signedUrlByPath[viewingPhoto.path] && (
            <img
              src={signedUrlByPath[viewingPhoto.path]}
              alt={`Progress photo from ${formatDate(viewingPhoto.date)}`}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-[95vw] object-contain"
            />
          )}
          <p className="font-mono text-xs text-chalk-dim">
            {captionFor(viewingPhoto, userId, profileByUserId)}
          </p>
        </div>
      )}
    </div>
  )
}

export default ProgressPhotosPage
