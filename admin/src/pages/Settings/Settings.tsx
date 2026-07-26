import { useEffect, useMemo, useState } from 'react';
import { ROLES } from '@elite/shared';

import {
  EmptyState,
  ErrorState,
  FormSection,
  PageHeader,
  Spinner,
  TextField,
} from '@/components/ui';
import { RoleGate } from '@/features/auth';
import { useSaveSetting, useSettings, type SettingDTO } from '@/features/ops';
import { getApiErrorMessage } from '@/lib/apiClient';

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

/**
 * Human copy for the standard setting groups. Groups that don't match one of
 * these fall through to the raw name (capitalised).
 */
const GROUP_META: Record<string, { title: string; description: string }> = {
  store: {
    title: 'Store',
    description: 'Storefront identity, hours, and public-facing details.',
  },
  delivery: {
    title: 'Delivery',
    description: 'Slot windows, delivery fees, cutoffs, and dispatch defaults.',
  },
  payments: {
    title: 'Payments',
    description: 'Accepted methods, gateway keys, and refund behaviour.',
  },
  notifications: {
    title: 'Notifications',
    description: 'Email, SMS, and push templates used across the store.',
  },
};

function metaFor(group: string) {
  const key = group.toLowerCase();
  return (
    GROUP_META[key] ?? {
      title: group.charAt(0).toUpperCase() + group.slice(1),
      description: 'Additional configuration exposed by the backend.',
    }
  );
}

/**
 * Give the user a hint about what shape the value uses so they don't paste raw
 * JSON into a text field expecting a number.
 */
function hintFor(value: unknown): string {
  if (typeof value === 'number') return 'Number value';
  if (typeof value === 'boolean') return 'Boolean value — use `true` or `false`';
  if (value && typeof value === 'object') return 'JSON value — keep valid syntax';
  return 'Text value';
}

/** Coerce Setting.value into a text input string. */
function toInputValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/** Try to preserve the original type on save (number stays number, JSON stays JSON). */
function fromInputValue(text: string, original: unknown): unknown {
  if (typeof original === 'number') return Number(text);
  if (typeof original === 'boolean') return text === 'true';
  if (original && typeof original === 'object') {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

export default function Settings() {
  const { data, isLoading, isError, error, refetch } = useSettings();
  const save = useSaveSetting();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      const initial: Record<string, string> = {};
      for (const s of data) initial[s.key] = toInputValue(s.value);
      setDrafts(initial);
    }
  }, [data]);

  const grouped = useMemo(() => {
    const acc: Record<string, SettingDTO[]> = {};
    for (const s of data ?? []) {
      (acc[s.group] ??= []).push(s);
    }
    return acc;
  }, [data]);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Store settings" subtitle="Config the store shows publicly and uses internally." />
        <div className="d-flex justify-content-center py-5">
          <Spinner label="Loading settings…" />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Store settings" subtitle="Config the store shows publicly and uses internally." />
        <ErrorState
          title="Couldn't load settings"
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </>
    );
  }

  if (!data || data.length === 0) {
    return (
      <>
        <PageHeader title="Store settings" subtitle="Config the store shows publicly and uses internally." />
        <EmptyState
          icon="settings"
          title="No settings configured"
          message="Seed the settings table from the backend to expose config here."
        />
      </>
    );
  }

  async function onSave(s: SettingDTO) {
    const raw = drafts[s.key] ?? '';
    setPendingKey(s.key);
    try {
      await save.mutateAsync({
        key: s.key,
        body: { value: fromInputValue(raw, s.value), group: s.group },
      });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Store settings"
        subtitle="Config the store shows publicly and uses internally."
      />
      {Object.entries(grouped).map(([group, items]) => {
        const meta = metaFor(group);
        return (
          <div className="card mb-3" key={group}>
            <div className="card-body">
              <FormSection title={meta.title} description={meta.description}>
                <div className="d-flex flex-column gap-3">
                  {items.map((s) => {
                    const hint = hintFor(s.value);
                    return (
                      <div className="row g-2 align-items-end" key={s.key}>
                        <div className="col-12 col-md-8">
                          <TextField
                            label={s.key}
                            hint={hint}
                            value={drafts[s.key] ?? ''}
                            onChange={(e) =>
                              setDrafts({ ...drafts, [s.key]: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-12 col-md-2 d-grid">
                          <RoleGate allow={ADMIN_ROLES}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => onSave(s)}
                              disabled={save.isPending}
                              aria-label={`Save ${s.key}`}
                            >
                              {pendingKey === s.key ? <Spinner size="sm" /> : 'Save'}
                            </button>
                          </RoleGate>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </FormSection>
            </div>
          </div>
        );
      })}
    </>
  );
}
