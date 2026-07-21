import { describe, it, expect, vi, afterEach } from 'vitest';
import { isNode, isBrowser, isReactNative } from '../src/utils/env';

describe('Environment Detection Utility (Issue #128)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isNode', () => {
    it('returns true in standard Node.js environments', () => {
      // The Vitest runner is a Node environment
      expect(isNode()).toBe(true);
    });

    it('returns false when process is undefined', () => {
      vi.stubGlobal('process', undefined);
      expect(isNode()).toBe(false);
    });

    it('returns false when process.versions.node is missing', () => {
      vi.stubGlobal('process', { versions: {} });
      expect(isNode()).toBe(false);
    });
  });

  describe('isBrowser', () => {
    it('returns false in a pure Node environment without DOM', () => {
      // Assuming Vitest runs without JSDOM by default
      expect(isBrowser()).toBe(false);
    });

    it('returns true when window and document exist', () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('document', {});
      expect(isBrowser()).toBe(true);
    });
  });

  describe('isReactNative', () => {
    it('returns false in standard environments', () => {
      expect(isReactNative()).toBe(false);
    });

    it('returns true when navigator.product is ReactNative', () => {
      vi.stubGlobal('navigator', { product: 'ReactNative' });
      expect(isReactNative()).toBe(true);
    });
  });
});