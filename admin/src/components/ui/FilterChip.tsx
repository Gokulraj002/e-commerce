import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';

interface FilterChipProps {
  /** Chip label. */
  label: ReactNode;
  /** Optional leading icon. */
  icon?: IconName;
  /** Highlighted state (used when the chip represents an applied filter). */
  active?: boolean;
  /** Click handler — clicking a chip typically toggles a filter. */
  onClick?: () => void;
  /** Show an "×" clear affordance on the trailing edge (fires `onClear`). */
  onClear?: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Chip used inside the filters strip that sits above premium list pages.
 * Pill button with an active/tinted state and an optional clear affordance.
 */
export function FilterChip({
  label,
  icon,
  active = false,
  onClick,
  onClear,
  className = '',
  disabled = false,
}: FilterChipProps) {
  const classes = ['ui-chip', active ? 'is-active' : '', className].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      {icon && (
        <span className="ui-chip__icon" aria-hidden="true">
          <Icon name={icon} size={13} />
        </span>
      )}
      <span className="ui-chip__label">{label}</span>
      {onClear && active && (
        <span
          role="button"
          tabIndex={-1}
          className="ui-chip__clear"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label="Clear filter"
        >
          <Icon name="close" size={12} />
        </span>
      )}
    </button>
  );
}
