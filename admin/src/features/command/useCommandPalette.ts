import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Global command-palette state. Any component in the tree can call `toggle()`
 * (typically from a topbar chip) and the provider itself owns the ⌘K / Ctrl+K
 * keyboard shortcut so the palette is always one keystroke away.
 */
export interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

/** Focus is inside something the user is editing — leave ⌘K alone in that case. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

interface CommandPaletteProviderProps {
  children: ReactNode;
}

/**
 * Wraps the app so descendants can consume the command-palette context and so
 * a single window-level keydown listener toggles the palette on ⌘K / Ctrl+K.
 * The listener bails out when the user is typing in an editable target so the
 * shortcut cannot steal keystrokes mid-word.
 */
export function CommandPaletteProvider({ children }: CommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier) return;
      if (event.key.toLowerCase() !== 'k') return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      setIsOpen((v) => !v);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );

  return createElement(CommandPaletteContext.Provider, { value }, children);
}

/** Access the command-palette controls; throws if used outside the provider. */
export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error('useCommandPalette must be used within a <CommandPaletteProvider>');
  }
  return ctx;
}
