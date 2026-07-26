import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge, Button, Card } from '@/components/ui';
import {
  AccountLayout,
  useAddresses,
  useMyOrders,
  useProfile,
  useUpdateProfile,
} from '@/features/account';
import { TierProgressCard } from '@/features/loyalty/TierProgressCard';
import { useLoyaltyStatus } from '@/features/loyalty/useLoyaltyStatus';
import { getApiErrorMessage } from '@/lib/apiClient';
import { paths } from '@/routes/routes';

interface StatCardProps {
  label: string;
  value: string;
  to: string;
}

function StatCard({ label, value, to }: StatCardProps): JSX.Element {
  return (
    <Link to={to} className="en-link-reset col-6 col-md-4">
      <Card hoverable padding="md" className="h-100">
        <div className="en-text-muted small text-uppercase" style={{ letterSpacing: '0.08em' }}>
          {label}
        </div>
        <div className="en-display h3 mb-0 mt-1">{value}</div>
      </Card>
    </Link>
  );
}

export default function Account(): JSX.Element {
  const { data: profile } = useProfile();
  const ordersQuery = useMyOrders({ page: 1, pageSize: 1 });
  const addressesQuery = useAddresses();
  const updateProfile = useUpdateProfile();
  // Loyalty status is null for guests; the widget silently no-ops in that
  // case so the Account page keeps working for every legacy flow.
  const loyalty = useLoyaltyStatus();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const orderCount = ordersQuery.data?.total;
  const addressCount = addressesQuery.data?.length;

  function startEdit(): void {
    setName(profile?.name ?? '');
    setEmail(profile?.email ?? '');
    setSaveError(null);
    setEditing(true);
  }

  async function saveProfile(): Promise<void> {
    setSaveError(null);
    try {
      await updateProfile.mutateAsync({
        name: name.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      setEditing(false);
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Could not save your profile.'));
    }
  }

  return (
    <AccountLayout eyebrow="My Account" title={`Hello, ${profile?.name ?? 'there'}`}>
      {/* Compact loyalty ladder — only rendered when we have status data.
          The full ladder + benefit split lives on /membership; here we show
          the same badges in a tighter card so the dashboard feels alive. */}
      {loyalty && (
        <div className="mb-4">
          <TierProgressCard status={loyalty} variant="compact" />
        </div>
      )}

      {/* Quick stats */}
      <div className="row g-3 mb-4">
        <StatCard
          label="Orders"
          value={orderCount !== undefined ? String(orderCount) : '—'}
          to={paths.orders()}
        />
        <StatCard
          label="Addresses"
          value={addressCount !== undefined ? String(addressCount) : '—'}
          to={paths.addresses()}
        />
        <Link to={paths.membership()} className="en-link-reset col-6 col-md-4">
          <Card hoverable padding="md" className="h-100">
            <div className="en-text-muted small text-uppercase" style={{ letterSpacing: '0.08em' }}>
              Membership
            </div>
            <div className="mt-2">
              {profile?.isMember ? (
                <Badge tone="gold">Elite member</Badge>
              ) : (
                <Badge tone="neutral">Not a member</Badge>
              )}
            </div>
          </Card>
        </Link>
      </div>

      {/* Profile card */}
      <Card padding="lg">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h2 className="en-display h4 mb-0">Profile details</h2>
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <div>
            {saveError && (
              <div className="alert alert-danger" role="alert">
                {saveError}
              </div>
            )}
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label htmlFor="acc-name" className="form-label">
                  Full name
                </label>
                <input
                  id="acc-name"
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="col-12 col-md-6">
                <label htmlFor="acc-email" className="form-label">
                  Email
                </label>
                <input
                  id="acc-email"
                  type="email"
                  className="form-control"
                  value={email}
                  placeholder="you@example.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="d-flex gap-2 mt-4">
              <Button
                variant="gold"
                onClick={() => void saveProfile()}
                isLoading={updateProfile.isPending}
              >
                Save changes
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={updateProfile.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <dl className="row mb-0">
            <dt className="col-4 col-sm-3 en-text-muted fw-normal">Name</dt>
            <dd className="col-8 col-sm-9">{profile?.name ?? '—'}</dd>
            <dt className="col-4 col-sm-3 en-text-muted fw-normal">Phone</dt>
            <dd className="col-8 col-sm-9">{profile?.phone ?? '—'}</dd>
            <dt className="col-4 col-sm-3 en-text-muted fw-normal">Email</dt>
            <dd className="col-8 col-sm-9 mb-0">{profile?.email ?? 'Not added'}</dd>
          </dl>
        )}
      </Card>
    </AccountLayout>
  );
}
