import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { hasOpenOverlay } from '@/hooks/useModalOverlay';

interface ReadingModeContextValue {
  isReadingMode: boolean;
  setReadingMode: (enabled: boolean) => void;
  toggleReadingMode: () => void;
  exitReadingMode: () => void;
}

const ReadingModeContext = createContext<ReadingModeContextValue | null>(null);

export const ReadingModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isReadingMode, setReadingMode] = useState(false);
  const locationKey = `${location.pathname}${location.search}`;
  const previousLocationKeyRef = useRef(locationKey);

  useEffect(() => {
    if (previousLocationKeyRef.current === locationKey) {
      return;
    }

    previousLocationKeyRef.current = locationKey;
    setReadingMode(false);
  }, [locationKey]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (isReadingMode) {
      document.documentElement.dataset.readingMode = 'true';
    } else {
      delete document.documentElement.dataset.readingMode;
    }

    return () => {
      delete document.documentElement.dataset.readingMode;
    };
  }, [isReadingMode]);

  useEffect(() => {
    if (!isReadingMode) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !hasOpenOverlay()) {
        event.preventDefault();
        setReadingMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReadingMode]);

  const toggleReadingMode = useCallback(() => {
    setReadingMode((value) => !value);
  }, []);
  const exitReadingMode = useCallback(() => setReadingMode(false), []);

  const value = useMemo(() => ({
    isReadingMode,
    setReadingMode,
    toggleReadingMode,
    exitReadingMode
  }), [exitReadingMode, isReadingMode, toggleReadingMode]);

  return <ReadingModeContext.Provider value={value}>{children}</ReadingModeContext.Provider>;
};

export const useReadingMode = () => {
  const context = useContext(ReadingModeContext);
  if (!context) {
    throw new Error('useReadingMode must be used within ReadingModeProvider');
  }
  return context;
};
