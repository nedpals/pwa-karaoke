import { useEffect, useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { RiMusic2Fill } from "../icons/RiMusic2Fill";

const albumArtVariants = cva(
  "relative aspect-square shrink-0 overflow-hidden border-2 border-ka-line-dim bg-ka-void bevel-in",
  {
    variants: {
      size: {
        sm: "w-12",
        md: "w-20",
        lg: "w-28",
        xl: "w-36",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface AlbumArtProps
  extends VariantProps<typeof albumArtVariants>,
    React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
}

export function AlbumArt({ src, alt = "", size, className, ...props }: AlbumArtProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  return (
    <div className={cn(albumArtVariants({ size }), className)} {...props}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <RiMusic2Fill className="w-1/2 h-1/2 text-ka-line" />
        </div>
      )}
    </div>
  );
}
