/**
 * Shared API + domain types used by backend responses and both React apps.
 * Feature-specific DTOs live alongside their feature; put here only what is
 * genuinely cross-cutting (API envelope, pagination, core entities).
 */
import type {
  Role,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  DeliveryStatus,
  CouponType,
} from '../constants/index.js';

/** Every API response is wrapped in this envelope. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

// ── Core domain DTOs (client-safe shapes; no secrets) ──────────────

export interface UserDTO {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: Role;
  isMember: boolean;
  createdAt: string;
}

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
}

export interface ProductVariantDTO {
  id: string;
  weightG: number; // pack weight in grams
  mrpPaise: number;
  pricePaise: number;
  inStock: boolean;
}

export interface ProductDTO {
  id: string;
  name: string;
  slug: string;
  shortDesc: string | null;
  description: string | null;
  categoryId: string;
  brandId: string | null;
  images: string[];
  tags: string[];
  isReadyToCook: boolean;
  rating: number;
  ratingCount: number;
  variants: ProductVariantDTO[];
}

export interface CartItemDTO {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  image: string | null;
  weightG: number;
  pricePaise: number;
  quantity: number;
  lineTotalPaise: number;
}

export interface CartDTO {
  id: string;
  items: CartItemDTO[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  couponCode: string | null;
}

export interface AddressDTO {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
}

export interface OrderItemDTO {
  id: string;
  productName: string;
  weightG: number;
  quantity: number;
  pricePaise: number;
  lineTotalPaise: number;
}

export interface OrderDTO {
  id: string;
  code: string; // human-friendly order number
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  items: OrderItemDTO[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  address: AddressDTO;
  slotLabel: string | null;
  placedAt: string;
}

export interface DeliverySlotDTO {
  id: string;
  label: string; // e.g. "Today 6–8 PM"
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  cutoffAt: string;
}

export interface CouponDTO {
  code: string;
  type: CouponType;
  valuePaise: number | null;
  percent: number | null;
  minCartPaise: number;
  description: string;
}

export interface DeliveryAssignmentDTO {
  id: string;
  orderCode: string;
  status: DeliveryStatus;
  partnerName: string | null;
  otpVerified: boolean;
  assignedAt: string | null;
}

export interface ReviewDTO {
  id: string;
  productId: string;
  productName?: string;
  userId: string;
  userName?: string;
  rating: number;
  title: string | null;
  body: string | null;
  isApproved: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: UserDTO;
  tokens: AuthTokens;
}
