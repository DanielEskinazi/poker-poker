import { useEffect, useState } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { storageService } from '../services/storageService';

/**
 * useBrowserFingerprint Hook
 *
 * Generates or retrieves a browser fingerprint for device identification.
 * Uses FingerprintJS for reliable cross-session identification.
 */
export function useBrowserFingerprint() {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function generateFingerprint() {
      try {
        // Try to get cached fingerprint from localStorage
        const cached = storageService.getBrowserFingerprint();
        if (cached) {
          setFingerprint(cached);
          setLoading(false);
          return;
        }

        // Generate new fingerprint using FingerprintJS
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const visitorId = result.visitorId;

        // Cache in localStorage
        storageService.saveBrowserFingerprint(visitorId);

        setFingerprint(visitorId);
        setLoading(false);
      } catch (err) {
        console.error('[Fingerprint] Failed to generate:', err);
        setError('Failed to generate device ID');
        setLoading(false);

        // Fallback to random ID if FingerprintJS fails
        const fallbackId = `fallback_${Math.random().toString(36).substring(2, 15)}`;
        storageService.saveBrowserFingerprint(fallbackId);
        setFingerprint(fallbackId);
      }
    }

    generateFingerprint();
  }, []);

  return { fingerprint, loading, error };
}
