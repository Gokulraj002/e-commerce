import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned actions, e.g. a "New product" button. */
  actions?: ReactNode;
}

/** Standard page title block with optional subtitle and action area. */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="ui-page-header">
      <div>
        <h1 className="ui-page-header__title">{title}</h1>
        {subtitle && <p className="ui-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="d-flex align-items-center gap-2">{actions}</div>}
    </div>
  );
}
