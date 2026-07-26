/**
 * Serviceability state + react-query wiring.
 *
 * `ServiceabilityProvider` mirrors the pattern used by `AuthContext`: a small
 * React context whose state is lazy-loaded from — and persisted to —
 * localStorage under the key `elite.serviceability`. That way the
 * "Deliver to <pincode>" pill in the header remembers the last answer across
 * reloads without a network round-trip.
 *
 * `useCheckServiceability` is a react-query mutation that hits the backend
 * and, on success, records the answer into the context (which persists it).
 *
 * NOTE: this file is intentionally `.ts` (not `.tsx`), so the Provider is
 * assembled with `React.createElement` to keep the file free of JSX literals.
 */
import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { checkServiceability, type ServiceabilityResult } from './serviceability.api';

const STORAGE_KEY = 'elite.serviceability';

/** Persisted result of the most recent successful serviceability check. */
export interface ServiceabilityRecord extends ServiceabilityResult {
  pincode: string;
  /** Epoch ms of the successful check (useful for future TTL logic). */
  checkedAt: number;
}

export interface ServiceabilityContextValue {
  /** Last known answer, or `null` if the user hasn't checked yet. */
  record: ServiceabilityRecord | null;
  setRecord: (record: ServiceabilityRecord) => void;
  clear: () => void;
}

const ServiceabilityContext = createContext<ServiceabilityContextValue | null>(null);

// ── Storage helpers ──────────────────────────────────────────
function loadFromStorage(): ServiceabilityRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ServiceabilityRecord> | null;
    if (
      !parsed ||
      typeof parsed.pincode !== 'string' ||
      typeof parsed.serviceable !== 'boolean' ||
      typeof parsed.feePaise !== 'number' ||
      typeof parsed.checkedAt !== 'number'
    ) {
      return null;
    }
    const zone: string | null =
      typeof parsed.zone === 'string' ? parsed.zone : parsed.zone === null ? null : null;
    return {
      pincode: parsed.pincode,
      serviceable: parsed.serviceable,
      feePaise: parsed.feePaise,
      checkedAt: parsed.checkedAt,
      zone,
    };
  } catch {
    return null;
  }
}

function saveToStorage(record: ServiceabilityRecord | null): void {
  try {
    if (record === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable (private mode) — keep in-memory only */
  }
}

// ── Provider ─────────────────────────────────────────────────
export function ServiceabilityProvider({ children }: { children: ReactNode }): JSX.Element {
  const [record, setState] = useState<ServiceabilityRecord | null>(loadFromStorage);

  const setRecord = useCallback((next: ServiceabilityRecord): void => {
    saveToStorage(next);
    setState(next);
  }, []);

  const clear = useCallback((): void => {
    saveToStorage(null);
    setState(null);
  }, []);

  const value = useMemo<ServiceabilityContextValue>(
    () => ({ record, setRecord, clear }),
    [record, setRecord, clear],
  );

  return createElement(ServiceabilityContext.Provider, { value }, children);
}

// ── Hooks ────────────────────────────────────────────────────
export function useServiceability(): ServiceabilityContextValue {
  const ctx = useContext(ServiceabilityContext);
  if (!ctx) throw new Error('useServiceability must be used within a <ServiceabilityProvider>');
  return ctx;
}

/**
 * Mutation hook that hits the serviceability endpoint and persists the answer
 * to the context on success. UI can use `.isPending`, `.error`, `.data` etc.
 */
export function useCheckServiceability(): UseMutationResult<ServiceabilityResult, Error, string> {
  const { setRecord } = useServiceability();
  return useMutation<ServiceabilityResult, Error, string>({
    mutationFn: (pincode) => checkServiceability(pincode),
    onSuccess: (result, pincode) => {
      setRecord({ ...result, pincode, checkedAt: Date.now() });
    },
  });
}
