"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function PhotoCarousel({
  photos,
  className = "",
  aspectClass = "aspect-[4/3]",
}: {
  photos: string[];
  className?: string;
  aspectClass?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const scrollTo = useCallback((i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({ left: i * w, behavior: "smooth" });
    setIndex(i);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const i = Math.round(el.scrollLeft / w);
      setIndex(Math.min(photos.length - 1, Math.max(0, i)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [photos.length]);

  if (!photos.length) {
    return (
      <div
        className={`flex w-full items-center justify-center rounded-[14px] bg-bg-deep text-[12px] text-text-dim ${aspectClass} ${className}`}
      >
        No photos
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden rounded-[14px] ${className}`}>
      <div
        ref={scrollerRef}
        className={`flex w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${aspectClass}`}
      >
        {photos.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="h-full w-full flex-shrink-0 snap-center snap-always"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>
      {photos.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => scrollTo(Math.max(0, index - 1))}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => scrollTo(Math.min(photos.length - 1, index + 1))}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => scrollTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-white" : "w-1.5 bg-white/45"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
