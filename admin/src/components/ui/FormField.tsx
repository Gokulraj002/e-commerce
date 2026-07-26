import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type MutableRefObject,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import type { FieldError } from 'react-hook-form';

import { Icon } from './Icon';

/**
 * Form primitives designed for React Hook Form's `register()`. Spread the
 * register result onto the input and pass `error` from `formState.errors`:
 *
 *   <TextField label="Name" error={errors.name} {...register('name')} />
 *
 * Every primitive here reserves a fixed row of space beneath the control for
 * hints / errors / counters so the surrounding layout never jumps as the user
 * blows through validation.
 */

// ── Utilities ────────────────────────────────────────────────────────────────

function assignRef<T>(ref: Ref<T> | null | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as MutableRefObject<T | null>).current = value;
}

// ── FormField (label + control + reserved message row) ───────────────────────

interface FieldShellProps {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: FieldError;
  children: ReactNode;
  className?: string;
  /** Optional right-aligned meta content (e.g. character counter). */
  counter?: ReactNode;
}

/** Label + hint + error scaffold around any control. */
export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
  counter,
}: FieldShellProps) {
  const wrap = ['ui-field', className].filter(Boolean).join(' ');
  return (
    <div className={wrap}>
      {label && (
        <label className="ui-field__label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="ui-field__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      <div className="ui-field__meta">
        <div className="ui-field__msg">
          {error ? (
            <span className="ui-field__error" role="alert">
              {error.message}
            </span>
          ) : hint ? (
            <span className="ui-field__hint">{hint}</span>
          ) : null}
        </div>
        {counter && <div className="ui-field__counter">{counter}</div>}
      </div>
    </div>
  );
}

// ── TextField ────────────────────────────────────────────────────────────────

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: FieldError;
  required?: boolean;
  /** Rendered inside the input frame, on the left. */
  leadingIcon?: ReactNode;
  /** Rendered inside the input frame, on the right. */
  trailingIcon?: ReactNode;
  /** Show a "N / max" counter under the field; turns red past the cap. */
  maxChars?: number;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    hint,
    error,
    required,
    id,
    leadingIcon,
    trailingIcon,
    maxChars,
    className,
    defaultValue,
    value: valueProp,
    onChange,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const localRef = useRef<HTMLInputElement | null>(null);
  const setRef = useCallback(
    (node: HTMLInputElement | null) => {
      localRef.current = node;
      assignRef(ref, node);
    },
    [ref],
  );

  const isControlled = valueProp !== undefined;
  const trackCounter = maxChars !== undefined;
  const [innerValue, setInnerValue] = useState<string>(() => {
    if (isControlled) return String(valueProp ?? '');
    if (defaultValue !== undefined) return String(defaultValue);
    return '';
  });

  // After mount, pick up the DOM value (RHF's `register` sets the ref
  // imperatively without firing a change event, so we sync once).
  useEffect(() => {
    if (!trackCounter) return;
    const el = localRef.current;
    if (el && el.value !== innerValue) setInnerValue(el.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isControlled) setInnerValue(String(valueProp ?? ''));
  }, [isControlled, valueProp]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (trackCounter && !isControlled) setInnerValue(e.target.value);
    onChange?.(e);
  };

  const currentLen = innerValue.length;
  const over = trackCounter && currentLen > (maxChars ?? Infinity);

  const wrapClass = [
    'ui-input-wrap',
    error ? 'is-invalid' : '',
    leadingIcon ? 'has-leading' : '',
    trailingIcon ? 'has-trailing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inputClass = ['form-control', 'ui-input', className].filter(Boolean).join(' ');

  return (
    <FormField
      label={label}
      htmlFor={inputId}
      required={required}
      hint={hint}
      error={error}
      counter={
        trackCounter ? (
          <span className={over ? 'is-over' : undefined}>
            {currentLen} / {maxChars}
          </span>
        ) : undefined
      }
    >
      <div className={wrapClass}>
        {leadingIcon && (
          <span className="ui-input__leading" aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        <input
          ref={setRef}
          id={inputId}
          className={inputClass}
          aria-invalid={error ? true : undefined}
          {...(isControlled
            ? { value: valueProp }
            : defaultValue !== undefined
              ? { defaultValue }
              : {})}
          onChange={handleChange}
          {...rest}
        />
        {trailingIcon && (
          <span className="ui-input__trailing" aria-hidden="true">
            {trailingIcon}
          </span>
        )}
      </div>
    </FormField>
  );
});

// ── TextareaField ────────────────────────────────────────────────────────────

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: FieldError;
  required?: boolean;
  /** Grow the textarea to fit its content, capped by `maxRows`. */
  autoGrow?: boolean;
  /** Max grown height in rows when `autoGrow` is on. Defaults to 8. */
  maxRows?: number;
  /** Show a "N / max" counter under the field. */
  maxChars?: number;
};

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField(
    {
      label,
      hint,
      error,
      required,
      id,
      rows = 4,
      autoGrow = false,
      maxRows = 8,
      maxChars,
      className,
      defaultValue,
      value: valueProp,
      onChange,
      ...rest
    },
    ref,
  ) {
    const autoId = useId();
    const textareaId = id ?? autoId;
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    const setRef = useCallback(
      (node: HTMLTextAreaElement | null) => {
        localRef.current = node;
        assignRef(ref, node);
      },
      [ref],
    );

    const isControlled = valueProp !== undefined;
    const trackCounter = maxChars !== undefined;
    const [innerValue, setInnerValue] = useState<string>(() => {
      if (isControlled) return String(valueProp ?? '');
      if (defaultValue !== undefined) return String(defaultValue);
      return '';
    });

    useEffect(() => {
      if (!trackCounter && !autoGrow) return;
      const el = localRef.current;
      if (el && el.value !== innerValue) setInnerValue(el.value);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (isControlled) setInnerValue(String(valueProp ?? ''));
    }, [isControlled, valueProp]);

    useLayoutEffect(() => {
      if (!autoGrow) return;
      const el = localRef.current;
      if (!el) return;
      el.style.height = 'auto';
      const style = window.getComputedStyle(el);
      const lineHeight = parseFloat(style.lineHeight) || 20;
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const paddingBottom = parseFloat(style.paddingBottom) || 0;
      const borderTop = parseFloat(style.borderTopWidth) || 0;
      const borderBottom = parseFloat(style.borderBottomWidth) || 0;
      const maxHeight =
        maxRows * lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
      const target = Math.min(el.scrollHeight, maxHeight);
      el.style.height = `${target}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [autoGrow, innerValue, maxRows]);

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      if ((trackCounter || autoGrow) && !isControlled) setInnerValue(e.target.value);
      onChange?.(e);
    };

    const currentLen = innerValue.length;
    const over = trackCounter && currentLen > (maxChars ?? Infinity);

    const wrapClass = ['ui-input-wrap', 'is-textarea', error ? 'is-invalid' : '']
      .filter(Boolean)
      .join(' ');
    const textareaClass = ['form-control', 'ui-input', 'ui-textarea', className]
      .filter(Boolean)
      .join(' ');

    return (
      <FormField
        label={label}
        htmlFor={textareaId}
        required={required}
        hint={hint}
        error={error}
        counter={
          trackCounter ? (
            <span className={over ? 'is-over' : undefined}>
              {currentLen} / {maxChars}
            </span>
          ) : undefined
        }
      >
        <div className={wrapClass}>
          <textarea
            ref={setRef}
            id={textareaId}
            rows={rows}
            data-auto-grow={autoGrow ? 'true' : undefined}
            className={textareaClass}
            aria-invalid={error ? true : undefined}
            {...(isControlled
              ? { value: valueProp }
              : defaultValue !== undefined
                ? { defaultValue }
                : {})}
            onChange={handleChange}
            {...rest}
          />
        </div>
      </FormField>
    );
  },
);

// ── SelectField ──────────────────────────────────────────────────────────────

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: FieldError;
  required?: boolean;
  children: ReactNode;
};

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, required, id, className, children, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const wrapClass = ['ui-select-wrap', error ? 'is-invalid' : ''].filter(Boolean).join(' ');
  const selectClass = ['form-select', 'ui-select', className].filter(Boolean).join(' ');
  return (
    <FormField label={label} htmlFor={selectId} required={required} hint={hint} error={error}>
      <div className={wrapClass}>
        <select
          ref={ref}
          id={selectId}
          className={selectClass}
          aria-invalid={error ? true : undefined}
          {...rest}
        >
          {children}
        </select>
        <span className="ui-select__caret" aria-hidden="true">
          <Icon name="chevron-down" size={16} />
        </span>
      </div>
    </FormField>
  );
});

// ── CheckboxField ────────────────────────────────────────────────────────────

type CheckLikeFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: ReactNode;
  description?: ReactNode;
  error?: FieldError;
};

export const CheckboxField = forwardRef<HTMLInputElement, CheckLikeFieldProps>(
  function CheckboxField(
    { label, description, error, id, className, disabled, ...rest },
    ref,
  ) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const wrapClass = ['ui-check', disabled ? 'is-disabled' : '', className]
      .filter(Boolean)
      .join(' ');
    return (
      <div className="ui-check-field">
        <label htmlFor={inputId} className={wrapClass}>
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className="ui-check__input"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            {...rest}
          />
          {(label || description) && (
            <span className="ui-check__body">
              {label && <span className="ui-check__label">{label}</span>}
              {description && <span className="ui-check__desc">{description}</span>}
            </span>
          )}
        </label>
        {error && (
          <div className="ui-field__error ui-check-field__error" role="alert">
            {error.message}
          </div>
        )}
      </div>
    );
  },
);

// ── SwitchField ──────────────────────────────────────────────────────────────

export const SwitchField = forwardRef<HTMLInputElement, CheckLikeFieldProps>(
  function SwitchField(
    { label, description, error, id, className, disabled, ...rest },
    ref,
  ) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const wrapClass = ['ui-switch', disabled ? 'is-disabled' : '', className]
      .filter(Boolean)
      .join(' ');
    return (
      <div className="ui-check-field">
        <label htmlFor={inputId} className={wrapClass}>
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            role="switch"
            className="ui-switch__input"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            {...rest}
          />
          {(label || description) && (
            <span className="ui-check__body">
              {label && <span className="ui-check__label">{label}</span>}
              {description && <span className="ui-check__desc">{description}</span>}
            </span>
          )}
        </label>
        {error && (
          <div className="ui-field__error ui-check-field__error" role="alert">
            {error.message}
          </div>
        )}
      </div>
    );
  },
);

// ── RadioGroupField ──────────────────────────────────────────────────────────

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

type RadioGroupFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: FieldError;
  required?: boolean;
  options: RadioOption[];
  /** Render the options inline (row) rather than stacked. */
  inline?: boolean;
};

export const RadioGroupField = forwardRef<HTMLInputElement, RadioGroupFieldProps>(
  function RadioGroupField(
    {
      label,
      hint,
      error,
      required,
      options,
      inline,
      id,
      name,
      className,
      onChange,
      onBlur,
      ...rest
    },
    ref,
  ) {
    const autoId = useId();
    const groupId = id ?? autoId;
    const labelId = `${groupId}-label`;
    const wrapClass = ['ui-field', className].filter(Boolean).join(' ');
    return (
      <div className={wrapClass}>
        {label && (
          <div className="ui-field__label" id={labelId}>
            {label}
            {required && (
              <span className="ui-field__required" aria-hidden="true">
                *
              </span>
            )}
          </div>
        )}
        <div
          className="ui-radio-group"
          role="radiogroup"
          aria-labelledby={label ? labelId : undefined}
          aria-invalid={error ? true : undefined}
          data-inline={inline ? 'true' : undefined}
        >
          {options.map((opt, i) => {
            const optId = `${groupId}-${String(opt.value)}`;
            const isFirst = i === 0;
            return (
              <label key={String(opt.value)} htmlFor={optId} className="ui-radio">
                <input
                  ref={isFirst ? ref : undefined}
                  id={optId}
                  type="radio"
                  className="ui-radio__input"
                  name={name}
                  value={opt.value}
                  disabled={opt.disabled}
                  onChange={onChange}
                  onBlur={onBlur}
                  {...rest}
                />
                <span className="ui-radio__body">
                  <span className="ui-radio__label">{opt.label}</span>
                  {opt.description && (
                    <span className="ui-radio__desc">{opt.description}</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        <div className="ui-field__meta">
          <div className="ui-field__msg">
            {error ? (
              <span className="ui-field__error" role="alert">
                {error.message}
              </span>
            ) : hint ? (
              <span className="ui-field__hint">{hint}</span>
            ) : null}
          </div>
        </div>
      </div>
    );
  },
);

// ── FormSection ──────────────────────────────────────────────────────────────

interface FormSectionProps {
  title: ReactNode;
  description?: ReactNode;
  /** Optional supporting node beneath the description (e.g. a help link). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Two-column section (title/description on the left, fields on the right at
 * `md` and up; stacked below). Great for split settings pages.
 */
export function FormSection({
  title,
  description,
  aside,
  children,
  className,
}: FormSectionProps) {
  const cls = ['ui-form-section', className].filter(Boolean).join(' ');
  return (
    <section className={cls}>
      <div className="ui-form-section__heading">
        <h3 className="ui-form-section__title">{title}</h3>
        {description && <p className="ui-form-section__description">{description}</p>}
        {aside && <div className="ui-form-section__aside">{aside}</div>}
      </div>
      <div className="ui-form-section__body">{children}</div>
    </section>
  );
}

// ── FormActions ──────────────────────────────────────────────────────────────

interface FormActionsProps {
  children: ReactNode;
  /** Pin the row to the bottom of the scroll container. */
  sticky?: boolean;
  align?: 'left' | 'right' | 'between';
  className?: string;
}

/** Sticky footer row for form Cancel/Save buttons. */
export function FormActions({
  children,
  sticky = false,
  align = 'right',
  className,
}: FormActionsProps) {
  const cls = [
    'ui-form-actions',
    sticky ? 'is-sticky' : '',
    align === 'left' ? 'is-left' : '',
    align === 'between' ? 'is-between' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <div className={cls}>{children}</div>;
}
