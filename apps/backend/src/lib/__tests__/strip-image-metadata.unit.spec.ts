import { stripImageMetadata } from "../strip-image-metadata";

const segment = (marker: number, payload: string) => {
  const data = Buffer.from(payload, "latin1");
  const head = Buffer.from([0xff, marker, 0, 0]);
  head.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([head, data]);
};

const pngChunk = (name: string, payload: string) => {
  const data = Buffer.from(payload, "latin1");
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(name, 4, "latin1");
  return Buffer.concat([head, data, Buffer.alloc(4)]);
};

const webpChunk = (name: string, payload: Buffer) => {
  const head = Buffer.alloc(8);
  head.write(name, 0, "latin1");
  head.writeUInt32LE(payload.length, 4);
  return Buffer.concat([
    head,
    payload,
    payload.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0),
  ]);
};

describe("stripping photo metadata", () => {
  it("drops a JPEG's EXIF, IPTC and comments, keeping the image and colour profile", () => {
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      segment(0xe0, "JFIF\0"),
      segment(0xe1, "Exif\0\0GPS 6.5244N 3.3792E"),
      segment(0xe2, "ICC_PROFILE\0"),
      segment(0xed, "Photoshop 3.0 IPTC"),
      segment(0xfe, "taken at home"),
      segment(0xdb, "quant"),
      Buffer.from([0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]),
    ]);
    const clean = stripImageMetadata(jpeg, "image/jpeg")!;
    const text = clean.toString("latin1");
    expect(text).not.toContain("GPS");
    expect(text).not.toContain("IPTC");
    expect(text).not.toContain("taken at home");
    expect(text).toContain("JFIF");
    expect(text).toContain("ICC_PROFILE");
    expect(text).toContain("quant");
    expect(clean.subarray(-3)).toEqual(Buffer.from([3, 0xff, 0xd9]));
  });

  it("drops PNG text, EXIF and time chunks", () => {
    const png = Buffer.concat([
      Buffer.from("89504e470d0a1a0a", "hex"),
      pngChunk("IHDR", "header"),
      pngChunk("tEXt", "Author\0Ada at 12 Allen Avenue"),
      pngChunk("eXIf", "GPS"),
      pngChunk("IDAT", "pixels"),
      pngChunk("IEND", ""),
    ]);
    const text = stripImageMetadata(png, "image/png")!.toString("latin1");
    expect(text).not.toContain("Allen Avenue");
    expect(text).not.toContain("GPS");
    expect(text).toContain("pixels");
    expect(text).toContain("IEND");
  });

  it("drops WebP EXIF and XMP and clears their flags", () => {
    const vp8x = Buffer.alloc(10);
    vp8x[0] = 0x08 | 0x04 | 0x10;
    const body = Buffer.concat([
      webpChunk("VP8X", vp8x),
      webpChunk("VP8 ", Buffer.from("frame")),
      webpChunk("EXIF", Buffer.from("GPS 6.52N")),
      webpChunk("XMP ", Buffer.from("<x:xmpmeta/>")),
    ]);
    const header = Buffer.alloc(12);
    header.write("RIFF", 0, "latin1");
    header.writeUInt32LE(body.length + 4, 4);
    header.write("WEBP", 8, "latin1");
    const clean = stripImageMetadata(
      Buffer.concat([header, body]),
      "image/webp",
    )!;
    const text = clean.toString("latin1");
    expect(text).not.toContain("GPS");
    expect(text).not.toContain("xmpmeta");
    expect(text).toContain("frame");
    expect(clean.readUInt32LE(4)).toBe(clean.length - 8);
    expect(clean[20] & 0x0c).toBe(0);
    expect(clean[20] & 0x10).toBe(0x10);
  });

  it("refuses files that aren't laid out as their type says", () => {
    expect(
      stripImageMetadata(Buffer.from([0xff, 0xd8, 1, 2]), "image/jpeg"),
    ).toBeNull();
    expect(stripImageMetadata(Buffer.from("nope"), "image/png")).toBeNull();
    expect(
      stripImageMetadata(
        Buffer.concat([Buffer.from([0xff, 0xd8]), segment(0xe1, "Exif")]),
        "image/jpeg",
      ),
    ).toBeNull();
  });
});
