interface PortalFooterProps {
  address?: string | null
  phone?: string | null
  website?: string | null
}

export function PortalFooter({ address, phone, website }: PortalFooterProps) {
  return (
    <footer className="mt-8 text-center space-y-1">
      {address && (
        <p className="text-xs text-slate-500">{address}</p>
      )}
      {(phone || website) && (
        <p className="text-xs text-slate-500 flex items-center justify-center gap-3">
          {phone && <span>{phone}</span>}
          {phone && website && <span>·</span>}
          {website && (
            <a
              href={website.startsWith('http') ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              {website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </p>
      )}
      <p className="text-xs text-slate-600 pt-1">
        Powered by{' '}
        <span className="text-slate-500 font-medium">HOA Portal</span>
      </p>
    </footer>
  )
}
