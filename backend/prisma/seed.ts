/**
 * Elite NonVeg — database seed (fresh-meat store, Hyderabad, INR).
 *
 * Conventions: money in PAISE (₹1 = 100), stock/weight in GRAMS.
 * Idempotent: everything is upserted by a unique key (or a stable explicit id),
 * so running `npm run seed` repeatedly converges to the same state.
 *
 * Test users (DO NOT change credentials — depended on by manual QA + tests):
 *   • SUPER_ADMIN     admin@elitenonveg.in  / Admin@123     (+919000000001)
 *   • Staff logins    <role>@elitenonveg.in / Admin@123
 *   • Customers       <name>@example.com     / Customer@123
 */
import { PrismaClient, Role, CouponType } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────────
const rupees = (n: number): number => Math.round(n * 100); // → paise

/** Build a stable Unsplash CDN URL for a known photo id. */
const unsplash = (id: string): string =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

/**
 * Curated pool of stable Unsplash photo IDs — every URL below has been
 * probed and returns HTTP 200 as a JPEG. Grouped by subject so product
 * galleries can pick semantically appropriate images.
 */
const IMG = {
  // Raw chicken (curry cut / boneless / whole).
  chickenA: unsplash('1587593810167-a84920ea0781'),
  chickenB: unsplash('1604503468506-a8da13d82791'),
  chickenC: unsplash('1682991136736-a2b44623eeba'),
  chickenD: unsplash('1672787153720-e85fe802fd9f'),
  chickenE: unsplash('1642102903996-cdad15f5dcdd'),
  chickenF: unsplash('1672787153655-0c19308dcc60'),

  // Chicken parts / cooked-look (wings, drumsticks, fried).
  chickenWingsA: unsplash('1608039755401-742074f0548d'),
  chickenWingsB: unsplash('1567620832903-9fc6debc209f'),
  chickenDrumsA: unsplash('1638439430466-b2bb7fdc1d67'),
  chickenDrumsB: unsplash('1610057099443-64836ddec508'),

  // Marinated / ready-to-cook chicken (tikka, 65, kebab).
  chickenMarinatedA: unsplash('1670398564097-0762e1b30b3a'),
  chickenMarinatedB: unsplash('1603496987351-f84a3ba5ec85'),
  chickenMarinatedC: unsplash('1652545296821-09a023a9fd08'),
  chickenMarinatedD: unsplash('1598515214211-89d3c73ae83b'),
  readyToCook: unsplash('1610057099431-d73a1c9d2f2f'),

  // Mutton (goat / lamb) — raw cuts.
  muttonA: unsplash('1603360946369-dc9bb6258143'),
  muttonB: unsplash('1717980651515-7796a793002f'),
  muttonC: unsplash('1632154023554-c2975e9be348'),
  muttonD: unsplash('1690983320937-ca293f1d1d97'),
  muttonE: unsplash('1630334337820-84afb05acf3a'),

  // Mutton chops (bone-in cutlets).
  muttonChopsA: unsplash('1629224803318-c4f3a8f06f3c'),
  muttonChopsB: unsplash('1628543108325-1c27cd7246b3'),
  muttonChopsC: unsplash('1603048374877-b98f840ad441'),

  // Fish (fillet + whole).
  fishA: unsplash('1519708227418-c8fd9a32b7a2'),
  fishFilletA: unsplash('1772285253181-b1257afb3698'),
  fishFilletB: unsplash('1773739685848-a46fb41ae4f0'),
  fishFilletC: unsplash('1764345960391-9b66a2541deb'),
  fishFilletD: unsplash('1763062550082-2c9f94096abb'),
  fishMarketA: unsplash('1611214774777-3d997a9d0e35'),
  fishMarketB: unsplash('1646400165624-d7e29ffccd29'),
  fishMarketC: unsplash('1674066620888-4878aad91094'),

  // Prawns / shrimp.
  prawnsA: unsplash('1565680018434-b513d5e5fd47'),
  prawnsB: unsplash('1504309250229-4f08315f3b5c'),
  prawnsC: unsplash('1578069744397-2f3942a02a7b'),
  prawnsD: unsplash('1674066625481-8cffd7cf5aac'),
  prawnsE: unsplash('1550951791-cbf1ff280109'),

  // Crab.
  crabA: unsplash('1553659971-f01207815844'),
  crabB: unsplash('1580841129862-bc2a2d113c45'),
  crabC: unsplash('1561361398-b2bc9f049851'),
  crabD: unsplash('1509415173911-37ff7a1aa29c'),

  // Eggs.
  eggsA: unsplash('1582722872445-44dc5f7e3c8f'),
  eggsB: unsplash('1639194335563-d56b83f0060c'),
  eggsC: unsplash('1498654077810-12c21d4d6dc3'),
  eggsD: unsplash('1506976785307-8732e854ad03'),
  eggsE: unsplash('1587486913049-53fc88980cfc'),

  // Quail & duck (game birds).
  quailA: unsplash('1676826518828-ab2e5899b99c'),
  quailB: unsplash('1686708043135-09d5770d770e'),
} as const;

interface VariantSeed {
  weightG: number;
  mrp: number; // rupees
  price: number; // rupees
}

interface ProductSeed {
  slug: string;
  name: string;
  shortDesc: string;
  description: string;
  categorySlug: string;
  brandSlug: string | null;
  isReadyToCook?: boolean;
  isFeatured?: boolean;
  tags: string[];
  images: string[]; // ≥3 for gallery
  variants: VariantSeed[];
}

interface ReviewSeed {
  productSlug: string;
  userPhone: string;
  rating: number;
  title: string;
  body: string;
}

async function main() {
  // ── Users ──────────────────────────────────────────────────────────
  const staffHash = await argon2.hash('Admin@123');
  const customerHash = await argon2.hash('Customer@123');

  const users: Array<{
    name: string;
    phone: string;
    email: string;
    role: Role;
    passwordHash: string;
  }> = [
    // Staff (do not change credentials).
    { name: 'Super Admin', phone: '+919000000001', email: 'admin@elitenonveg.in', role: Role.SUPER_ADMIN, passwordHash: staffHash },
    { name: 'Store Manager', phone: '+919000000002', email: 'store@elitenonveg.in', role: Role.STORE_MANAGER, passwordHash: staffHash },
    { name: 'Inventory Manager', phone: '+919000000003', email: 'inventory@elitenonveg.in', role: Role.INVENTORY_MANAGER, passwordHash: staffHash },
    { name: 'Delivery Manager', phone: '+919000000004', email: 'delivery@elitenonveg.in', role: Role.DELIVERY_MANAGER, passwordHash: staffHash },
    { name: 'Ravi (Delivery)', phone: '+919000000005', email: 'ravi.rider@elitenonveg.in', role: Role.DELIVERY_PARTNER, passwordHash: staffHash },
    { name: 'Imran (Delivery)', phone: '+919000000006', email: 'imran.rider@elitenonveg.in', role: Role.DELIVERY_PARTNER, passwordHash: staffHash },
    // Customers (Anjali & Karthik must remain — depended on by auth tests).
    { name: 'Anjali Reddy', phone: '+919000000010', email: 'anjali@example.com', role: Role.CUSTOMER, passwordHash: customerHash },
    { name: 'Karthik Rao', phone: '+919000000011', email: 'karthik@example.com', role: Role.CUSTOMER, passwordHash: customerHash },
    { name: 'Priya Menon', phone: '+919000000012', email: 'priya@example.com', role: Role.CUSTOMER, passwordHash: customerHash },
    { name: 'Sanjay Iyer', phone: '+919000000013', email: 'sanjay@example.com', role: Role.CUSTOMER, passwordHash: customerHash },
    { name: 'Fatima Khan', phone: '+919000000014', email: 'fatima@example.com', role: Role.CUSTOMER, passwordHash: customerHash },
    { name: 'Rahul Verma', phone: '+919000000015', email: 'rahul@example.com', role: Role.CUSTOMER, passwordHash: customerHash },
  ];

  const userByPhone = new Map<string, string>();
  for (const u of users) {
    const row = await prisma.user.upsert({
      where: { phone: u.phone },
      update: { name: u.name, email: u.email, role: u.role, isActive: true },
      create: { name: u.name, phone: u.phone, email: u.email, role: u.role, passwordHash: u.passwordHash },
    });
    userByPhone.set(u.phone, row.id);
  }

  // Delivery partner profiles.
  const partnerProfiles: Array<{ phone: string; vehicleNo: string; pincodes: string[] }> = [
    { phone: '+919000000005', vehicleNo: 'TS09AB1234', pincodes: ['500001', '500018', '500032'] },
    { phone: '+919000000006', vehicleNo: 'TS09CD5678', pincodes: ['500081', '500084', '500032'] },
  ];
  for (const p of partnerProfiles) {
    const userId = userByPhone.get(p.phone)!;
    await prisma.deliveryPartnerProfile.upsert({
      where: { userId },
      update: { vehicleNo: p.vehicleNo, zonePincodes: p.pincodes, isAvailable: true },
      create: { userId, vehicleNo: p.vehicleNo, zonePincodes: p.pincodes, isAvailable: true },
    });
  }

  // ── Warehouse ──────────────────────────────────────────────────────
  const warehouse = await prisma.warehouse.upsert({
    where: { id: 'wh_hyderabad_main' },
    update: { name: 'Elite NonVeg — Hyderabad Central', pincode: '500032', isActive: true },
    create: {
      id: 'wh_hyderabad_main',
      name: 'Elite NonVeg — Hyderabad Central',
      address: 'Gachibowli, Hyderabad, Telangana',
      pincode: '500032',
    },
  });

  // ── Categories ─────────────────────────────────────────────────────
  const categories: Array<{ slug: string; name: string; sortOrder: number; imageUrl: string }> = [
    { slug: 'poultry', name: 'Poultry', sortOrder: 1, imageUrl: IMG.chickenA },
    { slug: 'mutton', name: 'Mutton', sortOrder: 2, imageUrl: IMG.muttonA },
    { slug: 'seafood', name: 'Seafood', sortOrder: 3, imageUrl: IMG.fishA },
    { slug: 'eggs', name: 'Eggs', sortOrder: 4, imageUrl: IMG.eggsA },
    { slug: 'ready-to-cook', name: 'Ready-to-Cook', sortOrder: 5, imageUrl: IMG.readyToCook },
    { slug: 'bulk', name: 'Bulk', sortOrder: 6, imageUrl: IMG.chickenB },
  ];
  const categoryBySlug = new Map<string, string>();
  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, sortOrder: c.sortOrder, imageUrl: c.imageUrl, isActive: true },
      create: { slug: c.slug, name: c.name, sortOrder: c.sortOrder, imageUrl: c.imageUrl },
    });
    categoryBySlug.set(c.slug, row.id);
  }

  // ── Brands ─────────────────────────────────────────────────────────
  const brands: Array<{ slug: string; name: string }> = [
    { slug: 'elite-farms', name: 'Elite Farms' },
    { slug: 'coastal-catch', name: 'Coastal Catch' },
    { slug: 'country-pride', name: 'Country Pride' },
  ];
  const brandBySlug = new Map<string, string>();
  for (const b of brands) {
    const row = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name, isActive: true },
      create: { slug: b.slug, name: b.name },
    });
    brandBySlug.set(b.slug, row.id);
  }

  // ── Products (+ variants + images + inventory) ─────────────────────
  //
  // Pricing convention: MRP is the "printed" retail price, price is the sale
  // price — always 5–15% off the MRP so the storefront shows a strike-through.
  // Every product ships with ≥3 gallery images.
  const products: ProductSeed[] = [
    // ── Poultry (9) ────────────────────────────────────────────────
    {
      slug: 'chicken-curry-cut', name: 'Chicken Curry Cut', categorySlug: 'poultry', brandSlug: 'elite-farms',
      shortDesc: 'Skinless, bone-in curry cut',
      description:
        'Farm-fresh skinless chicken cut into curry-size pieces (roughly 25–30 g each). Sourced daily, cleaned, trimmed of excess fat and packed cold — ready for kadhai, korma or a weeknight gravy.',
      isFeatured: true, tags: ['chicken', 'curry', 'bone-in', 'best-seller'],
      images: [IMG.chickenA, IMG.chickenC, IMG.chickenB],
      variants: [
        { weightG: 250, mrp: 75, price: 65 },
        { weightG: 500, mrp: 140, price: 122 },
        { weightG: 1000, mrp: 260, price: 225 },
      ],
    },
    {
      slug: 'boneless-chicken', name: 'Boneless Chicken', categorySlug: 'poultry', brandSlug: 'elite-farms',
      shortDesc: 'Tender boneless breast & thigh cubes',
      description:
        'Premium boneless chicken hand-cut into 2 cm cubes — a mix of breast and thigh for the right balance of tender and juicy. Ideal for tikka, kebabs, chilli chicken and stir-fry.',
      isFeatured: true, tags: ['chicken', 'boneless', 'tikka-ready'],
      images: [IMG.chickenC, IMG.chickenA, IMG.chickenF],
      variants: [
        { weightG: 250, mrp: 115, price: 102 },
        { weightG: 500, mrp: 220, price: 195 },
        { weightG: 1000, mrp: 410, price: 365 },
      ],
    },
    {
      slug: 'chicken-biryani-cut', name: 'Chicken Biryani Cut', categorySlug: 'poultry', brandSlug: 'elite-farms',
      shortDesc: 'Large bone-in biryani pieces',
      description:
        'Bigger bone-in pieces cut specially for a rich, authentic Hyderabadi biryani — pieces hold their shape through slow dum cooking and release maximum flavour into the rice.',
      tags: ['chicken', 'biryani', 'bone-in'],
      images: [IMG.chickenB, IMG.chickenD, IMG.chickenA],
      variants: [
        { weightG: 500, mrp: 150, price: 132 },
        { weightG: 1000, mrp: 280, price: 245 },
      ],
    },
    {
      slug: 'chicken-wings', name: 'Chicken Wings', categorySlug: 'poultry', brandSlug: 'elite-farms',
      shortDesc: 'Whole wings — perfect for fry & bar-bites',
      description:
        'Whole chicken wings (drumette + flat + tip), cleaned and pat-dried. Marinate for 30 minutes and fry, grill or bake — a crowd favourite for movie nights and match days.',
      tags: ['chicken', 'wings', 'party', 'bar-food'],
      images: [IMG.chickenWingsA, IMG.chickenWingsB, IMG.chickenA],
      variants: [
        { weightG: 500, mrp: 190, price: 170 },
        { weightG: 1000, mrp: 360, price: 320 },
      ],
    },
    {
      slug: 'chicken-drumsticks', name: 'Chicken Drumsticks', categorySlug: 'poultry', brandSlug: 'elite-farms',
      shortDesc: 'Skinless drumsticks — juicy dark meat',
      description:
        'Meaty skinless drumsticks (approx. 90–110 g each). Great for tandoori, lollipop chicken or a quick Sunday roast — the bone keeps them moist even after a hard grill.',
      isFeatured: true, tags: ['chicken', 'drumsticks', 'dark-meat', 'grill'],
      images: [IMG.chickenDrumsA, IMG.chickenDrumsB, IMG.chickenB],
      variants: [
        { weightG: 500, mrp: 175, price: 155 },
        { weightG: 1000, mrp: 340, price: 300 },
      ],
    },
    {
      slug: 'chicken-liver', name: 'Chicken Liver', categorySlug: 'poultry', brandSlug: 'elite-farms',
      shortDesc: 'Cleaned, deveined chicken liver',
      description:
        'Fresh chicken liver, hand-cleaned and deveined so there is no bitterness. Iron-rich and perfect for a Kerala-style fry, liver pâté or a quick masala with onions and pepper.',
      tags: ['chicken', 'liver', 'offal', 'iron-rich'],
      images: [IMG.chickenC, IMG.chickenE, IMG.chickenB],
      variants: [
        { weightG: 250, mrp: 85, price: 75 },
        { weightG: 500, mrp: 160, price: 140 },
      ],
    },
    {
      slug: 'country-chicken', name: 'Country Chicken (Natu Kodi)', categorySlug: 'poultry', brandSlug: 'country-pride',
      shortDesc: 'Free-range natu kodi, curry cut',
      description:
        'Free-range country chicken (natu kodi) with the firm texture and deep flavour a slow gravy demands. Cut into curry pieces — best cooked low-and-slow with black pepper and coconut.',
      tags: ['country-chicken', 'natu-kodi', 'free-range'],
      images: [IMG.chickenD, IMG.chickenF, IMG.chickenA],
      variants: [
        { weightG: 500, mrp: 320, price: 285 },
        { weightG: 1000, mrp: 610, price: 545 },
      ],
    },
    {
      slug: 'kadaknath-chicken', name: 'Kadaknath Chicken', categorySlug: 'poultry', brandSlug: 'country-pride',
      shortDesc: 'Black-meat Kadaknath, curry cut',
      description:
        'Prized black-meat Kadaknath, low in fat and rich in protein — a heritage Indian breed with a distinctive dark flesh and intense flavour. Curry cut, bone-in.',
      tags: ['kadaknath', 'premium', 'black-meat'],
      images: [IMG.chickenE, IMG.chickenB, IMG.chickenD],
      variants: [
        { weightG: 500, mrp: 470, price: 425 },
        { weightG: 1000, mrp: 900, price: 810 },
      ],
    },
    {
      slug: 'quail', name: 'Quail (Kaadai)', categorySlug: 'poultry', brandSlug: 'country-pride',
      shortDesc: 'Whole dressed quail',
      description:
        'Cleaned whole quail (approx. 180–220 g each) — a South Indian delicacy for kaadai fry, pepper roast or a slow-cooked masala. Firm, gamey and quick to cook.',
      tags: ['quail', 'kaadai', 'game-bird'],
      images: [IMG.quailA, IMG.quailB, IMG.chickenB],
      variants: [
        { weightG: 500, mrp: 300, price: 265 },
        { weightG: 1000, mrp: 560, price: 500 },
      ],
    },

    // ── Mutton (4) ─────────────────────────────────────────────────
    {
      slug: 'mutton-curry-cut', name: 'Mutton Curry Cut', categorySlug: 'mutton', brandSlug: 'elite-farms',
      shortDesc: 'Bone-in goat curry cut',
      description:
        'Fresh goat mutton with bone, cut into curry pieces (roughly 40–50 g each). Tender, flavourful and perfect for a Sunday mutton curry, rogan josh or Hyderabadi salan.',
      isFeatured: true, tags: ['mutton', 'goat', 'curry', 'bone-in'],
      images: [IMG.muttonA, IMG.muttonB, IMG.muttonD],
      variants: [
        { weightG: 250, mrp: 240, price: 215 },
        { weightG: 500, mrp: 450, price: 405 },
        { weightG: 1000, mrp: 880, price: 785 },
      ],
    },
    {
      slug: 'mutton-boneless', name: 'Mutton Boneless', categorySlug: 'mutton', brandSlug: 'elite-farms',
      shortDesc: 'Boneless goat meat',
      description:
        'Boneless goat mutton hand-cut into cubes — great for keema, sukka, seekh kebab or a slow-cooked roast. Trimmed of sinew for even cooking.',
      tags: ['mutton', 'boneless', 'goat'],
      images: [IMG.muttonC, IMG.muttonE, IMG.muttonA],
      variants: [
        { weightG: 250, mrp: 300, price: 270 },
        { weightG: 500, mrp: 580, price: 525 },
      ],
    },
    {
      slug: 'mutton-chops', name: 'Mutton Chops', categorySlug: 'mutton', brandSlug: 'elite-farms',
      shortDesc: 'Bone-in mutton rib chops',
      description:
        'Bone-in rib chops, French-trimmed for a clean presentation. Marinate with garlic-yogurt and grill, or slow-braise with onions and whole spices for a champaran-style dish.',
      tags: ['mutton', 'chops', 'ribs', 'grill'],
      images: [IMG.muttonChopsA, IMG.muttonChopsB, IMG.muttonChopsC],
      variants: [
        { weightG: 500, mrp: 620, price: 555 },
        { weightG: 1000, mrp: 1200, price: 1075 },
      ],
    },
    {
      slug: 'mutton-keema', name: 'Mutton Keema', categorySlug: 'mutton', brandSlug: 'elite-farms',
      shortDesc: 'Fresh minced goat mutton',
      description:
        'Fresh goat mutton minced coarse on the day — no fillers, no stale scraps. Perfect for keema-pav, kheema matar, samosa filling or juicy seekh kebabs.',
      tags: ['mutton', 'keema', 'mince', 'goat'],
      images: [IMG.muttonB, IMG.muttonD, IMG.muttonE],
      variants: [
        { weightG: 250, mrp: 260, price: 230 },
        { weightG: 500, mrp: 500, price: 445 },
      ],
    },

    // ── Seafood (5) ────────────────────────────────────────────────
    {
      slug: 'prawns', name: 'Prawns (Medium, Cleaned)', categorySlug: 'seafood', brandSlug: 'coastal-catch',
      shortDesc: 'Deveined medium prawns',
      description:
        'Fresh medium prawns (approx. 30–40 count per 500 g), deveined and cleaned with tail-on for presentation. Ready for prawn fry, chettinad curry or a quick pasta.',
      isFeatured: true, tags: ['prawns', 'seafood', 'shrimp'],
      images: [IMG.prawnsA, IMG.prawnsB, IMG.prawnsC],
      variants: [
        { weightG: 250, mrp: 200, price: 180 },
        { weightG: 500, mrp: 380, price: 340 },
      ],
    },
    {
      slug: 'king-prawns', name: 'King Prawns (Jumbo)', categorySlug: 'seafood', brandSlug: 'coastal-catch',
      shortDesc: 'Deveined jumbo king prawns',
      description:
        'Jumbo king prawns (approx. 12–16 count per 500 g) — deveined, cleaned and shell-on for maximum flavour. A show-stopper for prawn masala, tandoor or garlic butter grill.',
      isFeatured: true, tags: ['prawns', 'king-prawns', 'jumbo', 'premium'],
      images: [IMG.prawnsD, IMG.prawnsE, IMG.prawnsA],
      variants: [
        { weightG: 250, mrp: 330, price: 295 },
        { weightG: 500, mrp: 640, price: 570 },
      ],
    },
    {
      slug: 'seer-fish', name: 'Seer Fish (Vanjaram) Steaks', categorySlug: 'seafood', brandSlug: 'coastal-catch',
      shortDesc: 'Premium vanjaram steaks',
      description:
        'Prized seer fish (vanjaram) cut into 2 cm-thick steaks. Firm, meaty and low-bone — the definitive fish for a South-Indian meen varuval or pepper fry.',
      tags: ['fish', 'vanjaram', 'seer', 'premium'],
      images: [IMG.fishA, IMG.fishMarketA, IMG.fishMarketB],
      variants: [
        { weightG: 250, mrp: 270, price: 240 },
        { weightG: 500, mrp: 500, price: 445 },
      ],
    },
    {
      slug: 'rohu-fish', name: 'Rohu Fish (Cleaned Cut)', categorySlug: 'seafood', brandSlug: 'coastal-catch',
      shortDesc: 'Cleaned rohu, curry cut',
      description:
        'Freshwater rohu — scaled, gutted and cut into curry pieces. A staple for Bengali maacher jhol or an Andhra chepala pulusu with tamarind and curry leaves.',
      tags: ['fish', 'rohu', 'freshwater'],
      images: [IMG.fishMarketC, IMG.fishA, IMG.fishFilletA],
      variants: [
        { weightG: 500, mrp: 170, price: 152 },
        { weightG: 1000, mrp: 320, price: 285 },
      ],
    },
    {
      slug: 'crab-mud', name: 'Mud Crab (Live-Fresh)', categorySlug: 'seafood', brandSlug: 'coastal-catch',
      shortDesc: 'Whole mud crab, cleaned',
      description:
        'Live-fresh Andhra mud crab, cleaned and packed with claws intact. A treat for a coastal-style crab masala or Singapore chilli crab. Handle with care — claws are strong.',
      tags: ['crab', 'seafood', 'shellfish', 'premium'],
      images: [IMG.crabA, IMG.crabB, IMG.crabC, IMG.crabD],
      variants: [
        { weightG: 500, mrp: 420, price: 380 },
        { weightG: 1000, mrp: 800, price: 720 },
      ],
    },

    // ── Eggs (1) ───────────────────────────────────────────────────
    {
      slug: 'farm-eggs', name: 'Farm Fresh Eggs', categorySlug: 'eggs', brandSlug: 'elite-farms',
      shortDesc: 'Grade-A white eggs — 6, 12 or 30 count',
      description:
        'Farm-fresh Grade-A eggs collected daily. Vaccinated hens, no antibiotics — packed by pack-weight below (500 g ≈ 6 eggs, 1000 g ≈ 12 eggs, 1500 g ≈ 30-count tray).',
      tags: ['eggs', 'grade-a', 'farm-fresh'],
      images: [IMG.eggsA, IMG.eggsB, IMG.eggsC, IMG.eggsD, IMG.eggsE],
      variants: [
        { weightG: 500, mrp: 72, price: 65 }, // ~6 eggs
        { weightG: 1000, mrp: 130, price: 115 }, // ~12 eggs
        { weightG: 1500, mrp: 300, price: 265 }, // 30-count tray
      ],
    },

    // ── Ready-to-Cook (2) ──────────────────────────────────────────
    {
      slug: 'chicken-65-ready', name: 'Chicken 65 (Ready-to-Cook)', categorySlug: 'ready-to-cook', brandSlug: 'elite-farms',
      shortDesc: 'Marinated boneless — just fry',
      description:
        'Boneless chicken cubes marinated in the classic Chicken 65 masala — red-chilli, ginger-garlic, curry leaves and a hint of yogurt. Just deep-fry for 4 minutes and toss with tempered curry leaves.',
      isReadyToCook: true, isFeatured: true, tags: ['ready-to-cook', 'chicken-65', 'marinated', 'spicy'],
      images: [IMG.readyToCook, IMG.chickenMarinatedA, IMG.chickenMarinatedD],
      variants: [
        { weightG: 250, mrp: 150, price: 135 },
        { weightG: 500, mrp: 290, price: 260 },
      ],
    },
    {
      slug: 'chicken-tikka-ready', name: 'Marinated Chicken Tikka (Ready-to-Cook)', categorySlug: 'ready-to-cook', brandSlug: 'elite-farms',
      shortDesc: 'Yogurt-marinated tikka — grill or bake',
      description:
        'Boneless chicken thigh cubes marinated overnight in hung yogurt, ginger-garlic, kashmiri chilli and warm garam masala. Skewer and grill, or bake at 220°C for 12 minutes — bright, smoky, restaurant-style tikka at home.',
      isReadyToCook: true, isFeatured: true, tags: ['ready-to-cook', 'tikka', 'marinated', 'grill'],
      images: [IMG.chickenMarinatedB, IMG.chickenMarinatedC, IMG.chickenMarinatedA],
      variants: [
        { weightG: 250, mrp: 165, price: 145 },
        { weightG: 500, mrp: 320, price: 285 },
      ],
    },

    // ── Bulk (1) ───────────────────────────────────────────────────
    {
      slug: 'chicken-party-pack', name: 'Chicken Party Pack (Bulk)', categorySlug: 'bulk', brandSlug: 'elite-farms',
      shortDesc: 'Bulk curry cut for gatherings',
      description:
        'Large-format bone-in chicken curry cut for parties, hostels and events. Best value per kg. Delivered in vacuum-sealed food-grade packs.',
      tags: ['bulk', 'party', 'chicken', 'events'],
      images: [IMG.chickenB, IMG.chickenA, IMG.chickenD],
      variants: [
        { weightG: 1000, mrp: 250, price: 215 },
      ],
    },
  ];

  let variantCount = 0;
  let imageCount = 0;
  const productIdBySlug = new Map<string, string>();
  for (const p of products) {
    const categoryId = categoryBySlug.get(p.categorySlug)!;
    const brandId = p.brandSlug ? brandBySlug.get(p.brandSlug)! : null;

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name, shortDesc: p.shortDesc, description: p.description, categoryId,
        brandId, isReadyToCook: p.isReadyToCook ?? false, isFeatured: p.isFeatured ?? false,
        tags: p.tags, isActive: true,
      },
      create: {
        slug: p.slug, name: p.name, shortDesc: p.shortDesc, description: p.description, categoryId,
        brandId, isReadyToCook: p.isReadyToCook ?? false, isFeatured: p.isFeatured ?? false, tags: p.tags,
      },
    });
    productIdBySlug.set(p.slug, product.id);

    // Images (stable explicit ids for idempotency).
    for (let i = 0; i < p.images.length; i++) {
      const imgId = `${p.slug}-img-${i + 1}`;
      await prisma.productImage.upsert({
        where: { id: imgId },
        update: { url: p.images[i], productId: product.id, sortOrder: i, alt: `${p.name} — photo ${i + 1}` },
        create: { id: imgId, url: p.images[i], productId: product.id, sortOrder: i, alt: `${p.name} — photo ${i + 1}` },
      });
      imageCount++;
    }

    // Variants + inventory.
    for (const v of p.variants) {
      const sku = `${p.slug.toUpperCase()}-${v.weightG}`;
      const variant = await prisma.productVariant.upsert({
        where: { sku },
        update: { weightG: v.weightG, mrpPaise: rupees(v.mrp), pricePaise: rupees(v.price), productId: product.id, isActive: true },
        create: { sku, weightG: v.weightG, mrpPaise: rupees(v.mrp), pricePaise: rupees(v.price), productId: product.id },
      });
      variantCount++;

      await prisma.inventory.upsert({
        where: { variantId: variant.id },
        update: { warehouseId: warehouse.id, reorderLevelG: 5000 },
        create: { variantId: variant.id, warehouseId: warehouse.id, stockG: 50000, reservedG: 0, reorderLevelG: 5000 },
      });
    }
  }

  // ── Reviews (approved) ─────────────────────────────────────────────
  // 15 reviews spread across 8 popular products, from 6 different customers.
  // All 4–5 star, plausible copy. Ratings are recomputed onto Product below.
  const reviews: ReviewSeed[] = [
    // Chicken Curry Cut — 3 reviews.
    { productSlug: 'chicken-curry-cut', userPhone: '+919000000010', rating: 5, title: 'Fresh cut, delivered on time', body: 'Ordered in the morning, arrived cold and clean before noon. No smell, no water — this is what fresh chicken is meant to look like.' },
    { productSlug: 'chicken-curry-cut', userPhone: '+919000000011', rating: 4, title: 'Consistent quality', body: 'Third order and still the same clean cuts. The 500 g pack is perfect for a family of three.' },
    { productSlug: 'chicken-curry-cut', userPhone: '+919000000012', rating: 5, title: 'Weekly staple', body: 'Switched from my local butcher — cleaner cuts, better packing, and the delivery slot is bang on.' },

    // Boneless Chicken — 2 reviews.
    { productSlug: 'boneless-chicken', userPhone: '+919000000013', rating: 5, title: 'Perfect for tikka', body: 'Cubes are uniform in size, so grilling on the pan was even. Made restaurant-style tikka at home.' },
    { productSlug: 'boneless-chicken', userPhone: '+919000000014', rating: 4, title: 'Tender and clean', body: 'Meat was tender and there was no extra fat to trim. Would love a 750 g pack option.' },

    // Chicken Biryani Cut — 2 reviews.
    { productSlug: 'chicken-biryani-cut', userPhone: '+919000000013', rating: 5, title: 'Held up in dum', body: 'The larger pieces stayed intact through slow dum — exactly what a good biryani needs.' },
    { productSlug: 'chicken-biryani-cut', userPhone: '+919000000014', rating: 4, title: 'Great for weekends', body: 'Made a Sunday biryani for eight people with the 1 kg pack — plenty of meat per plate.' },

    // Mutton Curry Cut — 2 reviews.
    { productSlug: 'mutton-curry-cut', userPhone: '+919000000015', rating: 5, title: 'Actual goat, actual fresh', body: 'The meat had a proper mutton smell (which is a good thing) and cooked tender in 45 minutes in the pressure cooker.' },
    { productSlug: 'mutton-curry-cut', userPhone: '+919000000010', rating: 5, title: 'Sunday special', body: 'Bone-to-meat ratio was fair, no random hard bits. Curry turned out rich without needing extra oil.' },

    // Prawns — 2 reviews.
    { productSlug: 'prawns', userPhone: '+919000000011', rating: 4, title: 'Cleaned properly', body: 'The prawns were already deveined, which saved me 20 minutes. Fry was a hit.' },
    { productSlug: 'prawns', userPhone: '+919000000012', rating: 5, title: 'Sweet and fresh', body: 'You can tell when prawns are fresh — these were sweet, firm and not fishy at all.' },

    // Chicken 65 (RTC) — 1 review.
    { productSlug: 'chicken-65-ready', userPhone: '+919000000015', rating: 5, title: 'Restaurant-style at home', body: 'Ten minutes of frying and it tasted exactly like the chicken 65 at my favourite biryani place. Marinade was well-balanced — spicy but not overwhelming.' },

    // Farm Fresh Eggs — 1 review.
    { productSlug: 'farm-eggs', userPhone: '+919000000010', rating: 4, title: 'Zero cracks in the tray', body: 'The 30-count tray arrived with no broken eggs — carefully packed. Yolks are a healthy orange.' },

    // Seer Fish — 2 reviews.
    { productSlug: 'seer-fish', userPhone: '+919000000011', rating: 5, title: 'Meaty and clean', body: 'Thick steaks with almost no bones — perfect for a Chettinad-style meen varuval. Will reorder.' },
    { productSlug: 'seer-fish', userPhone: '+919000000012', rating: 4, title: 'Very fresh vanjaram', body: 'Not the cheapest option in the app but the freshness is unmistakable. Cooked into a lovely pepper fry.' },
  ];

  let reviewCount = 0;
  const ratingBuckets = new Map<string, number[]>(); // productId → ratings[]
  for (const r of reviews) {
    const productId = productIdBySlug.get(r.productSlug);
    const userId = userByPhone.get(r.userPhone);
    if (!productId || !userId) continue; // defensive — should never trip.

    await prisma.review.upsert({
      where: { productId_userId: { productId, userId } },
      update: { rating: r.rating, title: r.title, body: r.body, isApproved: true },
      create: { productId, userId, rating: r.rating, title: r.title, body: r.body, isApproved: true },
    });
    reviewCount++;

    const bucket = ratingBuckets.get(productId) ?? [];
    bucket.push(r.rating);
    ratingBuckets.set(productId, bucket);
  }

  // Recompute product.rating / product.ratingCount from the reviews above.
  for (const [productId, ratings] of ratingBuckets) {
    const avg = ratings.reduce((s, x) => s + x, 0) / ratings.length;
    await prisma.product.update({
      where: { id: productId },
      data: { rating: Math.round(avg * 10) / 10, ratingCount: ratings.length },
    });
  }

  // ── Delivery zone + slots ──────────────────────────────────────────
  const zone = await prisma.deliveryZone.upsert({
    where: { id: 'zone_hyd_central' },
    update: {
      name: 'Hyderabad Central',
      pincodes: ['500001', '500018', '500032', '500081', '500084', '500034', '500016'],
      feePaise: rupees(40),
      isActive: true,
    },
    create: {
      id: 'zone_hyd_central',
      name: 'Hyderabad Central',
      pincodes: ['500001', '500018', '500032', '500081', '500084', '500034', '500016'],
      feePaise: rupees(40),
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const atHour = (base: Date, h: number): Date => {
    const d = new Date(base);
    d.setHours(h, 0, 0, 0);
    return d;
  };

  const slots: Array<{ id: string; date: Date; label: string; start: string; end: string; cutoffHour: number }> = [
    { id: 'slot_today_morning', date: today, label: 'Today 7–9 AM', start: '07:00', end: '09:00', cutoffHour: 6 },
    { id: 'slot_today_evening', date: today, label: 'Today 6–8 PM', start: '18:00', end: '20:00', cutoffHour: 16 },
    { id: 'slot_tomorrow_morning', date: tomorrow, label: 'Tomorrow 7–9 AM', start: '07:00', end: '09:00', cutoffHour: 6 },
    { id: 'slot_tomorrow_evening', date: tomorrow, label: 'Tomorrow 6–8 PM', start: '18:00', end: '20:00', cutoffHour: 16 },
  ];
  for (const s of slots) {
    await prisma.deliverySlot.upsert({
      where: { id: s.id },
      update: { zoneId: zone.id, label: s.label, date: s.date, startTime: s.start, endTime: s.end, cutoffAt: atHour(s.date, s.cutoffHour), isActive: true },
      create: { id: s.id, zoneId: zone.id, label: s.label, date: s.date, startTime: s.start, endTime: s.end, capacity: 50, cutoffAt: atHour(s.date, s.cutoffHour) },
    });
  }

  // ── Coupons ────────────────────────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: { type: CouponType.PERCENT, percent: 10, maxDiscountPaise: rupees(150), minCartPaise: 49900, isActive: true, description: '10% off your first order (up to ₹150).' },
    create: { code: 'WELCOME10', type: CouponType.PERCENT, percent: 10, maxDiscountPaise: rupees(150), minCartPaise: 49900, description: '10% off your first order (up to ₹150).' },
  });
  await prisma.coupon.upsert({
    where: { code: 'FREESHIP' },
    update: { type: CouponType.FREE_SHIPPING, minCartPaise: 39900, isActive: true, description: 'Free delivery on orders above ₹399.' },
    create: { code: 'FREESHIP', type: CouponType.FREE_SHIPPING, minCartPaise: 39900, description: 'Free delivery on orders above ₹399.' },
  });

  // ── CMS pages ──────────────────────────────────────────────────────
  const pages: Array<{ slug: string; title: string; content: string }> = [
    { slug: 'about', title: 'About Elite NonVeg', content: 'Elite NonVeg delivers fresh, hygienically cut meat, seafood and eggs across Hyderabad — sourced daily and delivered cold.' },
    { slug: 'terms', title: 'Terms & Conditions', content: 'By using Elite NonVeg you agree to our ordering, delivery and returns policies. Prices are in INR and inclusive of applicable taxes.' },
    { slug: 'privacy', title: 'Privacy Policy', content: 'We respect your privacy. Your data is used only to fulfil orders and improve your experience, and is never sold to third parties.' },
    { slug: 'contact', title: 'Contact Us', content: 'Reach us on WhatsApp at +91 79890 20944 or email support@elitenonveg.in. We deliver across Hyderabad, 7 AM–9 PM.' },
  ];
  for (const pg of pages) {
    await prisma.cmsPage.upsert({
      where: { slug: pg.slug },
      update: { title: pg.title, content: pg.content, isPublished: true },
      create: { slug: pg.slug, title: pg.title, content: pg.content },
    });
  }

  // ── Banners ────────────────────────────────────────────────────────
  // Hero banner + a promo strip on the home page + a category-top banner
  // for the mutton listing (proves the CATEGORY_TOP position renders).
  const banners: Array<{
    id: string; title: string; imageUrl: string; link: string; position: string; sortOrder: number;
  }> = [
    {
      id: 'banner_home_hero', title: 'Fresh Meat, Delivered Cold', imageUrl: IMG.chickenA,
      link: '/category/poultry', position: 'HOME_HERO', sortOrder: 0,
    },
    {
      id: 'banner_home_strip', title: 'Flat 15% off on Ready-to-Cook — use code WELCOME10',
      imageUrl: IMG.readyToCook, link: '/category/ready-to-cook', position: 'HOME_STRIP', sortOrder: 0,
    },
    {
      id: 'banner_category_mutton', title: 'Sunday Mutton — cut fresh this morning',
      imageUrl: IMG.muttonA, link: '/category/mutton', position: 'CATEGORY_TOP', sortOrder: 0,
    },
  ];
  for (const b of banners) {
    await prisma.banner.upsert({
      where: { id: b.id },
      update: { title: b.title, imageUrl: b.imageUrl, link: b.link, position: b.position, sortOrder: b.sortOrder, isActive: true },
      create: { id: b.id, title: b.title, imageUrl: b.imageUrl, link: b.link, position: b.position, sortOrder: b.sortOrder },
    });
  }

  // ── Settings (public-safe group: "store") ──────────────────────────
  const settings: Array<{ key: string; value: unknown; group: string }> = [
    { key: 'store.name', value: 'Elite NonVeg', group: 'store' },
    { key: 'store.currency', value: 'INR', group: 'store' },
    { key: 'store.city', value: 'Hyderabad', group: 'store' },
    { key: 'store.supportWhatsapp', value: '+917989020944', group: 'store' },
    { key: 'store.freeShippingThresholdPaise', value: 69900, group: 'store' },
    { key: 'store.defaultDeliveryFeePaise', value: rupees(40), group: 'store' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value as object, group: s.group },
      create: { key: s.key, value: s.value as object, group: s.group },
    });
  }

  // ── Sample notifications for a customer ────────────────────────────
  const anjaliId = userByPhone.get('+919000000010')!;
  await prisma.notification.upsert({
    where: { id: 'notif_welcome_anjali' },
    update: {},
    create: {
      id: 'notif_welcome_anjali', userId: anjaliId, channel: 'IN_APP',
      title: 'Welcome to Elite NonVeg!', body: 'Use code WELCOME10 for 10% off your first order.',
      meta: { coupon: 'WELCOME10' },
    },
  });

  // ── Summary ────────────────────────────────────────────────────────
  const [
    userCount, customerCount, staffCount,
    catCount, brandCount, prodCount, featuredCount,
    reviewTotal, couponCount, pageCount, slotCount, bannerCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: Role.CUSTOMER } }),
    prisma.user.count({ where: { role: { in: [Role.SUPER_ADMIN, Role.ADMIN, Role.STORE_MANAGER, Role.INVENTORY_MANAGER, Role.DELIVERY_MANAGER, Role.CUSTOMER_SUPPORT, Role.DELIVERY_PARTNER] } } }),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.product.count(),
    prisma.product.count({ where: { isFeatured: true } }),
    prisma.review.count(),
    prisma.coupon.count(),
    prisma.cmsPage.count(),
    prisma.deliverySlot.count(),
    prisma.banner.count(),
  ]);

  // eslint-disable-next-line no-console
  console.log(`
✅ Seed complete — Elite NonVeg
   Login:        +919000000001 / Admin@123   (email: admin@elitenonveg.in)

   Users:        ${userCount}   (${staffCount} staff, ${customerCount} customers)
   Warehouse:    ${warehouse.name}
   Categories:   ${catCount}
   Brands:       ${brandCount}
   Products:     ${prodCount}   (${featuredCount} featured, ${variantCount} variants, ${imageCount} images, inventory seeded)
   Reviews:      ${reviewTotal}   (${reviewCount} added this run; product ratings recomputed for ${ratingBuckets.size} products)
   Coupons:      ${couponCount}   (WELCOME10, FREESHIP)
   Banners:      ${bannerCount}   (HOME_HERO + HOME_STRIP + CATEGORY_TOP)
   CMS pages:    ${pageCount}
   Delivery:     zone "${zone.name}", ${slotCount} slots
   Settings:     ${settings.length}   (group "store")
`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
