import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

const registerAfterEach = (globalThis as unknown as { afterEach: (fn: () => void) => void }).afterEach;

// Nettoyage automatique après chaque test
registerAfterEach(() => {
  cleanup();
});

// Mock des APIs navigateur non implémentées dans jsdom
const mockStorage: Record<string, string> = {};

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    },
  },
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    },
  },
  writable: true,
});

// Mock de matchMedia (nécessaire pour certains composants React)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});