import type { AddressDTO, AddressInput, Paginated, UserDTO } from '@elite/shared';
import type { Address, User } from '@prisma/client';

import { ApiError } from '../../utils/ApiError.js';
import { parsePagination } from '../../utils/http.js';

import { userRepository } from './user.repository.js';
import type { CustomersQuery, UpdateProfileInput } from './user.schema.js';
import type { AddressWriteData } from './user.types.js';

function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isMember: user.isMember,
    createdAt: user.createdAt.toISOString(),
  };
}

function toAddressDTO(address: Address): AddressDTO {
  return {
    id: address.id,
    label: address.label,
    name: address.name,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    pincode: address.pincode,
    lat: address.lat,
    lng: address.lng,
    isDefault: address.isDefault,
  };
}

/** Keep only the address scalar columns present in the payload (drops isDefault). */
function toAddressWriteData(input: Partial<AddressInput>): Partial<AddressWriteData> {
  const data: Partial<AddressWriteData> = {};
  if (input.label !== undefined) data.label = input.label;
  if (input.name !== undefined) data.name = input.name;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.line1 !== undefined) data.line1 = input.line1;
  if (input.line2 !== undefined) data.line2 = input.line2;
  if (input.city !== undefined) data.city = input.city;
  if (input.pincode !== undefined) data.pincode = input.pincode;
  if (input.lat !== undefined) data.lat = input.lat;
  if (input.lng !== undefined) data.lng = input.lng;
  return data;
}

async function loadOwnedAddress(userId: string, id: string): Promise<Address> {
  const address = await userRepository.findAddress(id);
  if (!address || address.userId !== userId) throw ApiError.notFound('Address not found');
  return address;
}

export const userService = {
  async getProfile(userId: string): Promise<UserDTO> {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    return toUserDTO(user);
  },

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserDTO> {
    if (input.email) {
      const owner = await userRepository.findByEmail(input.email);
      if (owner && owner.id !== userId) throw ApiError.conflict('Email is already in use');
    }
    const user = await userRepository.updateProfile(userId, {
      name: input.name,
      email: input.email,
    });
    return toUserDTO(user);
  },

  // ── Addresses ────────────────────────────────────────────────────
  async listAddresses(userId: string): Promise<AddressDTO[]> {
    const addresses = await userRepository.listAddresses(userId);
    return addresses.map(toAddressDTO);
  },

  async createAddress(userId: string, input: AddressInput): Promise<AddressDTO> {
    const existingCount = await userRepository.countAddresses(userId);
    const makeDefault = input.isDefault === true || existingCount === 0;
    const address = await userRepository.createAddress(
      userId,
      toAddressWriteData(input) as AddressWriteData,
      makeDefault,
    );
    return toAddressDTO(address);
  },

  async updateAddress(
    userId: string,
    id: string,
    input: Partial<AddressInput>,
  ): Promise<AddressDTO> {
    await loadOwnedAddress(userId, id);
    const makeDefault = input.isDefault === true;
    const address = await userRepository.updateAddress(
      userId,
      id,
      toAddressWriteData(input),
      makeDefault,
    );
    return toAddressDTO(address);
  },

  async deleteAddress(userId: string, id: string): Promise<void> {
    const address = await loadOwnedAddress(userId, id);
    await userRepository.deleteAddress(id);
    // Keep a default around if we just removed it.
    if (address.isDefault) {
      const next = await userRepository.firstAddress(userId);
      if (next) await userRepository.promoteDefault(next.id);
    }
  },

  async setDefaultAddress(userId: string, id: string): Promise<AddressDTO> {
    await loadOwnedAddress(userId, id);
    await userRepository.setDefaultAddress(userId, id);
    const updated = await userRepository.findAddress(id);
    if (!updated) throw ApiError.notFound('Address not found');
    return toAddressDTO(updated);
  },

  // ── Admin customer management ────────────────────────────────────
  async listCustomers(query: CustomersQuery): Promise<Paginated<UserDTO>> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const { items, total } = await userRepository.findCustomers({ skip, take, search: query.search });
    return {
      items: items.map(toUserDTO),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  async getCustomer(id: string): Promise<UserDTO> {
    const user = await userRepository.findCustomerById(id);
    if (!user) throw ApiError.notFound('Customer not found');
    return toUserDTO(user);
  },
};
