"use client";
import { Button } from "./ui/button";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

interface FloatingHeaderProps {
  isScrolled?: boolean;
  onStylizeClick?: () => void;
}

export function FloatingHeader({ isScrolled, onStylizeClick }: FloatingHeaderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [localScrolled, setLocalScrolled] = useState(false);
  const effectiveScrolled = typeof isScrolled === 'boolean' ? isScrolled : localScrolled;
  const gsapRef = useRef<any>(null);

  useLayoutEffect(() => {
    let ctx: any;
    (async () => {
      if (!containerRef.current) return;
      if (!gsapRef.current) {
        const mod = await import("gsap");
        gsapRef.current = mod.default || mod;
      }
      const gsap = gsapRef.current;
      ctx = gsap.context(() => {
        gsap.from(containerRef.current!, {
          y: -16,
          opacity: 0,
          duration: 0.4,
          ease: "power2.out",
        });
      });
    })();
    return () => ctx?.revert?.();
  }, []);

  useEffect(() => {
    if (typeof isScrolled === 'boolean') return; // parent controls it
    const handler = () => {
      const y = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setLocalScrolled(y > 10);
    };
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [isScrolled]);

  useLayoutEffect(() => {
    let ctx: any;
    (async () => {
      if (!containerRef.current) return;
      if (!gsapRef.current) {
        const mod = await import("gsap");
        gsapRef.current = mod.default || mod;
      }
      const gsap = gsapRef.current;
      ctx = gsap.context(() => {
        if (effectiveScrolled) {
          gsap.fromTo(
            containerRef.current!,
            { y: -6 },
            { y: 0, duration: 0.2, ease: "power2.out" }
          );
        } else {
          gsap.fromTo(
            containerRef.current!,
            { y: 0 },
            { y: 0, duration: 0.15, ease: "power2.out" }
          );
        }
      });
    })();
    return () => ctx?.revert?.();
  }, [effectiveScrolled]);

  useEffect(() => {
    (async () => {
      if (!gsapRef.current) {
        const mod = await import("gsap");
        gsapRef.current = mod.default || mod;
      }
      const gsap = gsapRef.current;
      const { ScrollToPlugin } = await import("gsap/ScrollToPlugin");
      gsap.registerPlugin(ScrollToPlugin);
    })();
  }, []);

  const handleStylize = () => {
    if (onStylizeClick) return onStylizeClick();
    (async () => {
      if (!gsapRef.current) {
        const mod = await import("gsap");
        gsapRef.current = mod.default || mod;
      }
      const gsap = gsapRef.current;
      const { ScrollToPlugin } = await import("gsap/ScrollToPlugin");
      gsap.registerPlugin(ScrollToPlugin);
      gsap.to(window, {
        duration: 0.8,
        ease: 'power2.out',
        scrollTo: { y: '#order-form', offsetY: 80 }
      });
    })();
  };

  return (
    <div 
      ref={containerRef}
      className={`fixed top-0 left-0 right-0 z-50 p-8 transition-all duration-300 ${
        effectiveScrolled ? 'bg-background/75 backdrop-blur-lg shadow-xl rounded-sm border border-border/50 mx-6 mt-6 px-3 py-2' : 'bg-transparent'
      }`}
    >
      <div className="w-full flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Styllio</h1>
        <div className="flex items-center space-x-2">
          <Button 
            className="rounded-sm"
            onClick={handleStylize}
          >
            Stylize your image - from{' '}
            <span className="text-sm">$2.50</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
