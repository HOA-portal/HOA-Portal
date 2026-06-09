interface PhotoGalleryProps {
  urls: string[]
  alt?: string
}

export function PhotoGallery({ urls, alt = 'photo' }: PhotoGalleryProps) {
  if (!urls.length) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {urls.map((url, i) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`${alt} ${i + 1}`}
            className="w-20 h-20 object-cover rounded-md border border-slate-200 hover:opacity-80 transition-opacity"
          />
        </a>
      ))}
    </div>
  )
}
