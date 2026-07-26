import type { ReactNode } from 'react';

interface FormSectionProps {
  title: string;
  /** Small helper text sitting under the title. */
  description?: ReactNode;
  /** Right-aligned trailing element (e.g. a "Add line" button). */
  action?: ReactNode;
  /** Compact vertical spacing. */
  dense?: boolean;
  children: ReactNode;
}

/**
 * Standard form section wrapper — title + optional description on top,
 * form fields underneath. Keeps drawers consistent without pulling in
 * new dependencies. Fully backward compatible; only rendered where
 * pages opt in.
 */
export function FormSection({ title, description, action, dense, children }: FormSectionProps) {
  return (
    <section className={`ui-form-section ${dense ? 'is-dense' : ''}`}>
      <header className="ui-form-section__head">
        <div>
          <h3 className="ui-form-section__title">{title}</h3>
          {description && <p className="ui-form-section__desc">{description}</p>}
        </div>
        {action && <div className="ui-form-section__action">{action}</div>}
      </header>
      <div className="ui-form-section__body">{children}</div>
    </section>
  );
}
