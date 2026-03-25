'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface RichTextImageBlockProps {
  src: string;
  alt: string;
  width?: string | null;
  height?: string | null;
  isSelected: boolean;
}

export default function RichTextImageBlock({
  src,
  alt,
  width,
  height,
  isSelected,
}: RichTextImageBlockProps) {
  return (
    <div
      className={cn(
        'relative my-2 inline-block rounded-md',
        isSelected && 'ring-2 ring-ring',
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width || undefined}
        height={height || undefined}
        className="max-w-full rounded-md block"
        draggable={false}
      />
    </div>
  );
}
