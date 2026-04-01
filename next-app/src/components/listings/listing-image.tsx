"use client";

import { useState } from "react";
import Image from "next/image";
import { Building2 } from "lucide-react";

type ListingImageProps = {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  /** Priority hint for above-the-fold images */
  priority?: boolean;
  /** Sizes hint for responsive images (default: card thumbnail) */
  sizes?: string;
};

/**
 * Optimized listing image component.
 *
 * Uses next/image for:
 *  - Automatic WebP/AVIF conversion (200KB JPEG → ~30KB WebP)
 *  - Responsive srcset (serves 384w for cards, 750w for detail)
 *  - Built-in lazy loading with blur placeholder
 *  - Edge caching (minimumCacheTTL from next.config.ts)
 *
 * Falls back to a Building2 icon when:
 *  - src is null/undefined/empty
 *  - Image fails to load (broken R2 URL, 404, etc.)
 */
export function ListingImage({
  src,
  alt,
  width = 400,
  height = 300,
  className = "h-full w-full object-cover",
  priority = false,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
}: ListingImageProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 ${className}`}>
        <Building2 className="h-10 w-10 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      sizes={sizes}
      priority={priority}
      quality={75}
      onError={() => setError(true)}
    />
  );
}
