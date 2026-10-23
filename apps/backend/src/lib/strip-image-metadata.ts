/**
 * Removes metadata from a customer's photo before it is stored: location
 * (GPS), camera and owner details, comments and timestamps. The storefront
 * re-encodes photos in the browser, which drops them too, but a direct API
 * call doesn't, and a photo of a damaged parcel can carry the customer's
 * home coordinates.
 *
 * Works on the file structure alone, without decoding pixels: JPEG APP1
 * (EXIF, XMP), APP13 (IPTC), other application segments and comments; PNG
 * text, EXIF and time chunks; WebP EXIF and XMP chunks. Colour profiles are
 * kept. A JPEG's EXIF orientation goes with the EXIF, so a photo that relied
 * on it may show rotated; the storefront's own uploads are already upright.
 *
 * Returns null when the file isn't laid out as its type says.
 */
export function stripImageMetadata(bytes: Buffer, type: string): Buffer | null {
  try {
    if (type === "image/jpeg") return stripJpeg(bytes);
    if (type === "image/png") return stripPng(bytes);
    if (type === "image/webp") return stripWebp(bytes);
  } catch {
    // A truncated or malformed file.
  }
  return null;
}

/** JFIF (E0), ICC colour profile (E2) and Adobe colour (EE) stay. */
const KEPT_JPEG_APP = new Set([0xe0, 0xe2, 0xee]);

function stripJpeg(bytes: Buffer): Buffer | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const kept: Buffer[] = [bytes.subarray(0, 2)];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    let markerAt = i + 1;
    while (bytes[markerAt] === 0xff) markerAt++; // fill bytes
    const marker = bytes[markerAt];
    if (marker === undefined) return null;
    // Start of scan: the image data and everything after it is kept as is.
    if (marker === 0xda) {
      kept.push(bytes.subarray(i));
      return Buffer.concat(kept);
    }
    // End of image, or markers without a length.
    if (marker === 0xd9) {
      kept.push(bytes.subarray(i, markerAt + 1));
      return Buffer.concat(kept);
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      kept.push(bytes.subarray(i, markerAt + 1));
      i = markerAt + 1;
      continue;
    }
    const length = bytes.readUInt16BE(markerAt + 1);
    const end = markerAt + 1 + length;
    if (length < 2 || end > bytes.length) return null;
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const drop = (isApp && !KEPT_JPEG_APP.has(marker)) || marker === 0xfe;
    if (!drop) kept.push(bytes.subarray(i, end));
    i = end;
  }
  return null;
}

const DROPPED_PNG_CHUNKS = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);

function stripPng(bytes: Buffer): Buffer | null {
  const signature = bytes.subarray(0, 8);
  if (signature.toString("hex") !== "89504e470d0a1a0a") return null;
  const kept: Buffer[] = [signature];
  let i = 8;
  while (i + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(i);
    const name = bytes.subarray(i + 4, i + 8).toString("latin1");
    const end = i + 12 + length;
    if (end > bytes.length) return null;
    if (!DROPPED_PNG_CHUNKS.has(name)) kept.push(bytes.subarray(i, end));
    i = end;
    if (name === "IEND") return Buffer.concat(kept);
  }
  return null;
}

/** VP8X flags for EXIF and XMP chunks, cleared with the chunks. */
const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;

function stripWebp(bytes: Buffer): Buffer | null {
  if (
    bytes.subarray(0, 4).toString("latin1") !== "RIFF" ||
    bytes.subarray(8, 12).toString("latin1") !== "WEBP"
  ) {
    return null;
  }
  const chunks: Buffer[] = [];
  let i = 12;
  while (i + 8 <= bytes.length) {
    const name = bytes.subarray(i, i + 4).toString("latin1");
    const size = bytes.readUInt32LE(i + 4);
    const end = i + 8 + size + (size % 2);
    if (i + 8 + size > bytes.length) return null;
    const chunk = Buffer.from(bytes.subarray(i, Math.min(end, bytes.length)));
    if (name === "VP8X") chunk[8] &= ~(VP8X_EXIF | VP8X_XMP);
    if (name !== "EXIF" && name !== "XMP ") chunks.push(chunk);
    i = end;
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WEBP", 8, "latin1");
  return Buffer.concat([header, body]);
}
