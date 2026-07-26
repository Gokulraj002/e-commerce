import { ROLES, type Role } from '@elite/shared';

import { Icon, PageHeader } from '@/components/ui';

/**
 * Read-only RBAC reference. Elite is a single-store platform, so roles are
 * fixed by the codebase; this view documents what each role can do rather
 * than editing role→permission mappings at runtime.
 */

interface Row {
  label: string;
  allow: Role[];
}

const ALL: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.STORE_MANAGER,
  ROLES.INVENTORY_MANAGER,
  ROLES.DELIVERY_MANAGER,
  ROLES.CUSTOMER_SUPPORT,
  ROLES.DELIVERY_PARTNER,
  ROLES.CUSTOMER,
];

const MATRIX: Row[] = [
  { label: 'Manage products & catalog', allow: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER] },
  { label: 'Manage inventory & purchases', allow: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.INVENTORY_MANAGER, ROLES.STORE_MANAGER] },
  { label: 'View & update orders', allow: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER, ROLES.CUSTOMER_SUPPORT] },
  { label: 'Change order status', allow: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER] },
  { label: 'Manage coupons', allow: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER] },
  { label: 'Assign deliveries & board', allow: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DELIVERY_MANAGER] },
  { label: 'Fulfil deliveries (partner app)', allow: [ROLES.DELIVERY_PARTNER] },
  { label: 'Moderate reviews', allow: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER] },
  { label: 'Manage CMS & banners', allow: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER] },
  { label: 'Edit store settings', allow: [ROLES.SUPER_ADMIN, ROLES.ADMIN] },
  { label: 'Refund payments', allow: [ROLES.SUPER_ADMIN, ROLES.ADMIN] },
  { label: 'View customer PII', allow: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CUSTOMER_SUPPORT, ROLES.STORE_MANAGER] },
  { label: 'Place orders on the storefront', allow: [ROLES.CUSTOMER] },
];

function has(row: Row, role: Role) {
  return row.allow.includes(role);
}

function humanizeRole(role: string): string {
  return role
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function Roles() {
  const capabilityCount = MATRIX.length;

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        subtitle="Fixed RBAC matrix. To change a permission, update the source and redeploy."
      />
      <div className="card">
        <div className="card-body">
          <div
            className="d-flex align-items-center gap-2 text-muted-2 small mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            <Icon name="shield" size={14} />
            <span className="tabular">
              {capabilityCount} capabilities · {ALL.length} roles · read-only
            </span>
          </div>
          <div className="ui-table-wrap">
            <table
              className="ui-table tabular"
              style={{ fontSize: 14 }}
            >
              <thead>
                <tr>
                  <th style={{ minWidth: 240 }}>Capability</th>
                  {ALL.map((r) => (
                    <th
                      key={r}
                      className="text-center"
                      style={{
                        writingMode: 'vertical-rl',
                        verticalAlign: 'bottom',
                        height: 120,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {humanizeRole(r)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row, idx) => (
                  <tr
                    key={row.label}
                    style={{
                      background:
                        idx % 2 === 1 ? 'var(--bg-body)' : 'transparent',
                    }}
                  >
                    <td
                      className="fw-semibold"
                      style={{ color: 'var(--text-strong)' }}
                    >
                      {row.label}
                    </td>
                    {ALL.map((r) => (
                      <td
                        key={r}
                        className="text-center"
                        style={{ tabSize: 1 }}
                      >
                        {has(row, r) ? (
                          <span
                            aria-label="allowed"
                            style={{
                              color: 'var(--success)',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            ✓
                          </span>
                        ) : (
                          <span
                            aria-label="not allowed"
                            style={{ color: 'var(--text-subtle)' }}
                          >
                            —
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
