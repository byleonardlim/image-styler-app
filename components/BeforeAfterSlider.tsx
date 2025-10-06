"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type BeforeAfterSliderProps = {
  beforeSrc: string;
  afterSrc: string;
  alt?: string;
  className?: string;
};

export default function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  alt = "Before and after example",
  className = "",
}: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [percent, setPercent] = useState(50);
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const p = (x / rect.width) * 100;
    setPercent(p);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      // Prevent scrolling/text selection during drag
      if (e.cancelable) e.preventDefault();
      const anyEvent = e as any;
      if (anyEvent && anyEvent.touches && anyEvent.touches.length > 0) {
        setFromClientX(anyEvent.touches[0].clientX);
        return;
      }
      setFromClientX((e as MouseEvent).clientX);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.userSelect = "";
      setIsDragging(false);
    };

    window.addEventListener("mousemove", onMove, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove as any);
      window.removeEventListener("touchmove", onMove as any);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [setFromClientX]);

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    dragging.current = true;
    document.body.style.userSelect = "none";
    setIsDragging(true);
    // Avoid text selection or unintended actions on start
    if ("preventDefault" in e) e.preventDefault();
    if ("touches" in e) {
      setFromClientX(e.touches[0].clientX);
    } else {
      setFromClientX((e as React.MouseEvent).clientX);
    }
  };

  const onClickTrack = (e: React.MouseEvent) => {
    setFromClientX(e.clientX);
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={containerRef}
        className={`relative w-full h-72 sm:h-96 overflow-hidden rounded-xl border bg-black/5 select-none touch-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        onClick={onClickTrack}
        onDragStart={(e) => e.preventDefault()}
        role="slider"
        aria-label={alt}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPercent((p) => Math.max(0, p - 5));
          if (e.key === "ArrowRight") setPercent((p) => Math.min(100, p + 5));
        }}
      >
        <img
          src={beforeSrc}
          alt={alt + " before"}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          draggable={false}
        />

        <div
          className="absolute inset-0"
          style={{
            // Use clip-path to reveal without affecting layout (prevents perceived resizing)
            clipPath: `polygon(0 0, ${percent}% 0, ${percent}% 100%, 0 100%)`,
          }}
        >
          <img
            src={afterSrc}
            alt={alt + " after"}
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            draggable={false}
          />
        </div>

        <div
          className="absolute inset-y-0"
          style={{ left: `calc(${percent}% - 1px)` }}
        >
          <div className="h-full w-0.5 bg-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
        </div>

        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{ left: `calc(${percent}% - 16px)` }}
        >
          <div className="h-8 w-8 rounded-full bg-white shadow-md border flex items-center justify-center text-xs font-medium text-foreground">
            ⇆
          </div>
        </div>

        <div className="absolute left-3 top-3 select-none">
          <span className="rounded-md bg-black/60 text-white px-2 py-1 text-xs">Before</span>
        </div>
        <div className="absolute right-3 top-3 select-none">
          <span className="rounded-md bg-black/60 text-white px-2 py-1 text-xs">After</span>
        </div>
      </div>
    </div>
  );
}
