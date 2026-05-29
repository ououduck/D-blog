import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

export const GlobalLiquidGlass = () => {
  const shouldReduceMotion = useReducedMotion();
  const rafRef = useRef<number | null>(null);
  const currentRef = useRef<HTMLElement | null>(null);
  const coordsRef = useRef({ x: 50, y: 50 });

  useEffect(() => {
    if (shouldReduceMotion) return;

    const updateHighlight = () => {
      if (currentRef.current) {
        currentRef.current.style.setProperty('--mouse-x', `${coordsRef.current.x}%`);
        currentRef.current.style.setProperty('--mouse-y', `${coordsRef.current.y}%`);
      }
      rafRef.current = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest('.liquid-glass') as HTMLElement | null;

      if (el !== currentRef.current) {
        if (currentRef.current) {
          currentRef.current.style.setProperty('--mouse-x', '50%');
          currentRef.current.style.setProperty('--mouse-y', '50%');
        }
        currentRef.current = el;
      }

      if (el) {
        const rect = el.getBoundingClientRect();
        coordsRef.current = {
          x: ((e.clientX - rect.left) / rect.width) * 100,
          y: ((e.clientY - rect.top) / rect.height) * 100,
        };
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(updateHighlight);
        }
      } else if (currentRef.current) {
        currentRef.current.style.setProperty('--mouse-x', '50%');
        currentRef.current.style.setProperty('--mouse-y', '50%');
        currentRef.current = null;
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [shouldReduceMotion]);

  return null;
};
