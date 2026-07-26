/**
 * Accessible tab strip for the PDP editorial layout.
 *
 * Implements the WAI-ARIA authoring practices "tab" pattern:
 *   - `role="tablist"` on the strip, `role="tab"` on each trigger,
 *     `role="tabpanel"` for each panel.
 *   - Roving tabindex — only the active tab is in the natural focus order,
 *     inactive tabs move focus via ArrowLeft/ArrowRight/Home/End.
 *   - Controlled or uncontrolled: pass `activeTabId` + `onTabChange` when the
 *     parent needs to steer selection (e.g. the buy-box rating link jumps to
 *     the Reviews tab), otherwise the component tracks it locally.
 *
 * Panels always render below the strip full-width — the currently selected
 * panel is visible, others are `hidden` (unmounted content) to keep the tree
 * lean and preserve initial-focus semantics for screen readers.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export interface InfoTab {
  id: string;
  label: string;
  content: ReactNode;
}

export interface InfoTabsProps {
  tabs: InfoTab[];
  /** Uncontrolled initial tab id. Ignored when `activeTabId` is provided. */
  defaultTabId?: string;
  /** Controlled active tab id. */
  activeTabId?: string;
  /** Fires whenever a tab is picked (mouse, keyboard, or programmatic). */
  onTabChange?: (id: string) => void;
  /** Optional accessible label for the tablist. */
  ariaLabel?: string;
}

export function InfoTabs({
  tabs,
  defaultTabId,
  activeTabId,
  onTabChange,
  ariaLabel = 'Product information',
}: InfoTabsProps): JSX.Element {
  const first = tabs[0]?.id ?? '';
  const [internal, setInternal] = useState<string>(defaultTabId ?? first);
  const active = activeTabId ?? internal;

  const listRef = useRef<HTMLDivElement>(null);

  // If the parent removes/renames tabs and the current selection disappears,
  // fall back to the first tab so we never render "no panel".
  useEffect(() => {
    if (!tabs.some((t) => t.id === active) && first) {
      if (activeTabId === undefined) setInternal(first);
      onTabChange?.(first);
    }
    // Only care about the shape of tabs — active/first derive from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.map((t) => t.id).join('|')]);

  const setActive = useCallback(
    (id: string): void => {
      if (activeTabId === undefined) setInternal(id);
      onTabChange?.(id);
    },
    [activeTabId, onTabChange],
  );

  const focusTab = useCallback((id: string): void => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-tab-id="${id}"]`,
    );
    el?.focus();
  }, []);

  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      const idx = tabs.findIndex((t) => t.id === active);
      if (idx === -1 || tabs.length === 0) return;
      let nextIdx: number | null = null;
      if (event.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIdx = 0;
      else if (event.key === 'End') nextIdx = tabs.length - 1;
      if (nextIdx === null) return;
      event.preventDefault();
      const next = tabs[nextIdx];
      if (next) {
        setActive(next.id);
        focusTab(next.id);
      }
    },
    [tabs, active, setActive, focusTab],
  );

  return (
    <div className="en-pdp-v2__tabs">
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        className="en-pdp-v2__tablist"
        onKeyDown={handleKey}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`en-pdp-v2-tab-${tab.id}`}
              data-tab-id={tab.id}
              aria-selected={isActive}
              aria-controls={`en-pdp-v2-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`en-pdp-v2__tab${isActive ? ' is-active' : ''}`}
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`en-pdp-v2-panel-${tab.id}`}
            aria-labelledby={`en-pdp-v2-tab-${tab.id}`}
            hidden={!isActive}
            className="en-pdp-v2__tabpanel"
            tabIndex={0}
          >
            {isActive && tab.content}
          </div>
        );
      })}
    </div>
  );
}
