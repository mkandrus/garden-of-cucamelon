import { useState, useEffect, useRef } from 'react'

export default function CameraCard() {
  const [upper, setUpper] = useState(null)
  const [lower, setLower] = useState(null)
  const [album, setAlbum] = useState(null)
  const [storageWarning, setStorageWarning] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [error, setError] = useState(null)
  const lightboxRef = useRef(null)

  useEffect(() => {
    loadLatest()
  }, [])

  async function loadLatest() {
    try {
      const data = await (await fetch('/photos/latest')).json()
      if (data.upper) setUpper(data.upper + '?t=' + Date.now())
      if (data.lower) setLower(data.lower + '?t=' + Date.now())
    } catch {
      // silently leave images unchanged
    }
  }

  async function takePhoto() {
    setCapturing(true)
    setError(null)
    try {
      const data = await (await fetch('/photos/capture', { method: 'POST' })).json()
      if (data.upper) setUpper(data.upper + '?t=' + Date.now())
      if (data.lower) setLower(data.lower + '?t=' + Date.now())
    } catch {
      setError('Photo capture failed')
    } finally {
      setCapturing(false)
    }
  }

  async function loadAlbum() {
    try {
      const data = await (await fetch('/photos')).json()
      setAlbum(data.photos)
      setStorageWarning(data.storage_warning)
    } catch {
      setError('Failed to load album')
    }
  }

  function openLightbox(src) {
    setLightboxSrc(src)
  }

  return (
    <div className="card card-wide">
      <p className="card-title">Camera</p>

      {storageWarning && (
        <div className="warning-banner">
          ⚠ Storage is above 8 GB — oldest photos are being deleted to make room.
        </div>
      )}

      <div className="photo-pair">
        <div className="photo-slot">
          <p>Upper camera</p>
          {upper
            ? <img src={upper} alt="upper camera" onClick={() => openLightbox(upper)} />
            : <img className="placeholder" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" alt="no photo" />
          }
        </div>
        <div className="photo-slot">
          <p>Lower camera</p>
          {lower
            ? <img src={lower} alt="lower camera" onClick={() => openLightbox(lower)} />
            : <img className="placeholder" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" alt="no photo" />
          }
        </div>
      </div>

      <div className="btn-row">
        <button className="btn-secondary" onClick={loadLatest}>Refresh</button>
        <button className="btn-secondary" onClick={takePhoto} disabled={capturing}>
          {capturing ? 'Capturing…' : 'Take Photo'}
        </button>
        <button className="btn-secondary" onClick={loadAlbum}>
          {album ? 'Reload Album' : 'Load Album'}
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {album && (
        <div className="album">
          {album.map(photo => (
            <div className="album-thumb" key={photo.filename}>
              <img
                src={photo.url}
                loading="lazy"
                alt={photo.filename}
                onClick={() => openLightbox(photo.url)}
              />
              <p>{photo.timestamp}<br />{photo.side}</p>
            </div>
          ))}
        </div>
      )}

      {lightboxSrc && (
        <div className="lightbox open" ref={lightboxRef} onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="fullscreen" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
