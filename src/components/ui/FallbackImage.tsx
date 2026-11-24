import { ImageOff } from 'lucide-react';

interface FallbackImageProps {
  src: string | null | undefined;
  alt: string;
  fallbackLabel?: string;
  className?: string;
  aspectClassName?: string;
}

export function FallbackImage({
  src,
  alt,
  fallbackLabel = 'No photos uploaded yet',
  className = '',
  aspectClassName = 'aspect-[4/3]',
}: FallbackImageProps) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] ${aspectClassName} ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover block"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center text-[var(--color-text-muted)]">
          <ImageOff className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs font-medium">{fallbackLabel}</span>
        </div>
      )}
    </div>
  );
}
