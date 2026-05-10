import sharp from "sharp";

export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .grayscale()
    .normalize()
    .linear(1.2, 0) // Boost contrast for cleaner glyphs
    .sharpen()
    .toBuffer();
}
