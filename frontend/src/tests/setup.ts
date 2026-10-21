import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { clearCache } from '../services/useLoad';

afterEach(() => {
  cleanup();
  clearCache();
  sessionStorage.clear();
  localStorage.clear();
});
