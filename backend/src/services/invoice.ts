/**
 * Invoice PDF generator.
 *
 * Loads a fully-shaped Order (items + address + payment) and renders a clean
 * A5 PDF via pdfkit, returning the bytes as a Buffer. The caller decides where
 * to persist it (see storage.ts + invoice.worker.ts).
 *
 * pdfkit is loaded through `createRequire` so this file still type-checks in
 * environments where the runtime dependency has not been installed yet — the
 * error surfaces at call time rather than at import time.
 */
import { createRequire } from 'node:module';

import { MONEY, STORE } from '@elite/shared';

import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';

// ── Minimal pdfkit surface (only what we call) ─────────────────────

type PDFTextAlign = 'left' | 'center' | 'right' | 'justify';

interface PDFTextOptions {
  align?: PDFTextAlign;
  width?: number;
  continued?: boolean;
  underline?: boolean;
  lineBreak?: boolean;
}

interface PDFDoc {
  readonly page: {
    width: number;
    height: number;
    margins: { top: number; bottom: number; left: number; right: number };
  };
  y: number;
  x: number;
  on(event: 'data', listener: (chunk: Buffer) => void): PDFDoc;
  on(event: 'end', listener: () => void): PDFDoc;
  on(event: 'error', listener: (err: Error) => void): PDFDoc;
  font(name: string): PDFDoc;
  fontSize(size: number): PDFDoc;
  fillColor(color: string): PDFDoc;
  strokeColor(color: string): PDFDoc;
  text(text: string, options?: PDFTextOptions): PDFDoc;
  text(text: string, x: number, y?: number, options?: PDFTextOptions): PDFDoc;
  moveDown(lines?: number): PDFDoc;
  moveTo(x: number, y: number): PDFDoc;
  lineTo(x: number, y: number): PDFDoc;
  stroke(): PDFDoc;
  end(): void;
}

interface PDFDocOptions {
  size?: 'A4' | 'A5' | 'LETTER' | [number, number];
  margin?: number;
  margins?: { top?: number; bottom?: number; left?: number; right?: number };
  info?: { Title?: string; Author?: string; Subject?: string };
}

type PDFDocCtor = new (options?: PDFDocOptions) => PDFDoc;

const nodeRequire = createRequire(import.meta.url);

function loadPdfKit(): PDFDocCtor {
  try {
    return nodeRequire('pdfkit') as PDFDocCtor;
  } catch {
    throw new Error(
      'pdfkit is not installed. Add `pdfkit` (and `@types/pdfkit` dev) to the backend workspace and re-install.',
    );
  }
}

// ── Formatting helpers ─────────────────────────────────────────────

/** Paise → "₹123.45" for display only. Money on the wire stays as paise. */
function money(paise: number): string {
  const rupees = paise / MONEY.UNIT_PER_RUPEE;
  return `${STORE.CURRENCY_SYMBOL}${rupees.toFixed(2)}`;
}

function formatDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy}`;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Render the invoice for the given order code and return the PDF bytes.
 * Throws `ApiError.notFound` when the order is missing.
 */
export async function generateInvoicePdf(orderCode: string): Promise<Buffer> {
  const order = await prisma.order.findUnique({
    where: { code: orderCode },
    include: { items: true, address: true, payment: true },
  });
  if (!order) throw ApiError.notFound(`Order ${orderCode} not found`);

  const PDFDocument = loadPdfKit();
  const doc = new PDFDocument({
    size: 'A5',
    margin: 30,
    info: {
      Title: `Invoice ${order.code}`,
      Author: STORE.NAME,
      Subject: 'Tax Invoice',
    },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => {
      chunks.push(chunk);
    });
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', (err) => {
      reject(err);
    });
  });

  const pageWidth = doc.page.width;
  const contentLeft = 30;
  const contentRight = pageWidth - 30;
  const contentWidth = contentRight - contentLeft;

  // ── Header ────────────────────────────────────────────────────
  doc.fillColor('#111111').font('Helvetica-Bold').fontSize(20);
  doc.text(STORE.NAME, contentLeft, 30, { align: 'center', width: contentWidth });
  doc.font('Helvetica').fontSize(10).fillColor('#666666');
  doc.text('Tax Invoice', contentLeft, doc.y, { align: 'center', width: contentWidth });
  doc.moveDown(0.5);
  doc.strokeColor('#cccccc').moveTo(contentLeft, doc.y).lineTo(contentRight, doc.y).stroke();
  doc.moveDown(0.6);

  // ── Invoice meta ──────────────────────────────────────────────
  doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10);
  doc.text(`Invoice #: ${order.code}`, contentLeft, doc.y);
  doc.font('Helvetica').text(`Date: ${formatDate(order.placedAt)}`);
  doc.moveDown(0.6);

  // ── Bill To ───────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(10).text('Bill To');
  doc.font('Helvetica').fontSize(9);
  doc.text(order.address.name);
  doc.text(order.address.phone);
  doc.text(order.address.line1);
  if (order.address.line2) doc.text(order.address.line2);
  doc.text(`${order.address.city} - ${order.address.pincode}`);
  doc.moveDown(0.8);

  // ── Items table ───────────────────────────────────────────────
  // Column x-positions across contentWidth ≈ 360pt (A5 - 60pt margins).
  const colName = contentLeft;
  const nameWidth = 160;
  const colWeight = contentLeft + 165;
  const weightWidth = 45;
  const colQty = contentLeft + 215;
  const qtyWidth = 35;
  const colPrice = contentLeft + 255;
  const priceWidth = 55;
  const colTotal = contentLeft + 315;
  const totalWidth = contentRight - colTotal;

  const headerY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111');
  doc.text('Item', colName, headerY, { width: nameWidth });
  doc.text('Wt (g)', colWeight, headerY, { width: weightWidth, align: 'right' });
  doc.text('Qty', colQty, headerY, { width: qtyWidth, align: 'right' });
  doc.text('Price', colPrice, headerY, { width: priceWidth, align: 'right' });
  doc.text('Total', colTotal, headerY, { width: totalWidth, align: 'right' });
  doc.moveDown(0.4);
  doc.strokeColor('#cccccc').moveTo(contentLeft, doc.y).lineTo(contentRight, doc.y).stroke();
  doc.moveDown(0.3);

  doc.font('Helvetica').fontSize(9).fillColor('#111111');
  for (const item of order.items) {
    const rowY = doc.y;
    // Draw the name first — it is the widest column and most likely to wrap.
    doc.text(item.productName, colName, rowY, { width: nameWidth });
    const nameBottom = doc.y;
    doc.text(String(item.weightG), colWeight, rowY, { width: weightWidth, align: 'right' });
    doc.text(String(item.quantity), colQty, rowY, { width: qtyWidth, align: 'right' });
    doc.text(money(item.pricePaise), colPrice, rowY, { width: priceWidth, align: 'right' });
    doc.text(money(item.lineTotalPaise), colTotal, rowY, { width: totalWidth, align: 'right' });
    // Advance the cursor to whichever cell wrapped the furthest.
    doc.y = Math.max(nameBottom, doc.y);
    doc.moveDown(0.2);
  }

  doc.moveDown(0.3);
  doc.strokeColor('#cccccc').moveTo(contentLeft, doc.y).lineTo(contentRight, doc.y).stroke();
  doc.moveDown(0.6);

  // ── Totals (right-aligned block) ──────────────────────────────
  const labelX = colPrice;
  const labelW = priceWidth;
  const valX = colTotal;
  const valW = totalWidth;

  const totalRow = (label: string, value: string, bold = false): void => {
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10);
    doc.text(label, labelX, y, { width: labelW, align: 'right' });
    doc.text(value, valX, y, { width: valW, align: 'right' });
    doc.moveDown(0.3);
  };

  totalRow('Subtotal', money(order.subtotalPaise));
  if (order.discountPaise > 0) {
    totalRow('Discount', `- ${money(order.discountPaise)}`);
  }
  totalRow('Shipping', money(order.shippingPaise));
  totalRow('Total', money(order.totalPaise), true);
  doc.moveDown(0.8);

  // ── Payment ───────────────────────────────────────────────────
  doc.font('Helvetica').fontSize(9).fillColor('#333333');
  doc.text(`Payment method: ${order.paymentMethod}`, contentLeft, doc.y);
  doc.text(`Payment status: ${order.paymentStatus}`);
  if (order.payment?.gatewayPaymentId) {
    doc.text(`Payment ref: ${order.payment.gatewayPaymentId}`);
  }
  doc.moveDown(1.5);

  // ── Footer ────────────────────────────────────────────────────
  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#888888');
  doc.text(
    'This is a computer-generated invoice and does not require a signature.',
    contentLeft,
    doc.y,
    { align: 'center', width: contentWidth },
  );
  doc.text(`Thank you for shopping with ${STORE.NAME}.`, {
    align: 'center',
    width: contentWidth,
  });

  doc.end();
  return done;
}
