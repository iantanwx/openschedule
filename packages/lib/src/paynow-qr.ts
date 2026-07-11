/**
 * PayNow QR string generator.
 *
 * Produces an EMVCo Merchant Presented QR code payload string
 * compatible with Singapore's PayNow standard.
 *
 * Reference: EMVCo Merchant QR Spec v1.1 + PayNow implementation.
 */

export interface PayNowQROptions {
  /** "phone" or "uen" */
  proxyType: "phone" | "uen";
  /** The phone number (with country code, e.g. "+6591234567") or UEN */
  proxyValue: string;
  /** Whether the payer can edit the amount (default: true) */
  editable?: boolean;
  /** Fixed amount in dollars (e.g. "10.00"). Omit for open amount. */
  amount?: string;
  /** Merchant/business name (max 25 chars). Defaults to "NA". */
  merchantName?: string;
  /** Reference/comment for reconciliation (max 25 chars). Optional. */
  reference?: string;
  /** Expiry date as YYYYMMDD. Defaults to "99991231" (no expiry). */
  expiryDate?: string;
}

/**
 * Encode a TLV field: tag (2 digits) + length (2 digits) + value.
 */
function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return tag + len + value;
}

/**
 * CRC16 CCITT FALSE (polynomial 0x1021, init 0xFFFF).
 */
function crc16CcittFalse(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Generate a PayNow QR code payload string.
 *
 * The returned string can be encoded into a QR code image using any
 * QR library (e.g. `qrcode` npm package).
 */
export function generatePayNowQRString(options: PayNowQROptions): string {
  const {
    proxyType,
    proxyValue,
    editable = true,
    amount,
    merchantName = "NA",
    reference,
    expiryDate = "99991231",
  } = options;

  // Tag 26: Merchant Account Information (PayNow)
  const proxyTypeCode = proxyType === "uen" ? "2" : "0";
  const tag26Inner =
    tlv("00", "SG.PAYNOW") +
    tlv("01", proxyTypeCode) +
    tlv("02", proxyValue) +
    tlv("03", editable ? "1" : "0") +
    tlv("04", expiryDate);

  let payload =
    tlv("00", "01") + // Payload Format Indicator
    tlv("01", "12") + // Point of Initiation (12 = dynamic)
    tlv("26", tag26Inner) + // Merchant Account Info
    tlv("52", "0000") + // Merchant Category Code
    tlv("53", "702") + // Transaction Currency (SGD)
    (amount ? tlv("54", amount) : "") + // Transaction Amount (optional)
    tlv("58", "SG") + // Country Code
    tlv("59", merchantName.slice(0, 25)) + // Merchant Name
    tlv("60", "Singapore"); // Merchant City

  // Tag 62: Additional Data (reference number)
  if (reference) {
    const tag62Inner = tlv("01", reference.slice(0, 25));
    payload += tlv("62", tag62Inner);
  }

  // Tag 63: CRC — append the tag+length first, then compute CRC over everything
  payload += "6304";
  const checksum = crc16CcittFalse(payload);
  payload += checksum;

  return payload;
}
