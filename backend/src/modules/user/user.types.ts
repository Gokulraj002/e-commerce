import type { AddressInput } from '@elite/shared';

export type { AddressInput };

/** Scalar address columns we accept for a create/update (no relations). */
export type AddressWriteData = Omit<AddressInput, 'isDefault'>;
