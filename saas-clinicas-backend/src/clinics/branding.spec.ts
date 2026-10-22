import { detectLogoMimeType } from './branding.js';

const bytes = (...parts: (number[] | string)[]) =>
  Uint8Array.from(
    parts.flatMap((part) =>
      typeof part === 'string' ? Array.from(Buffer.from(part, 'latin1')) : part,
    ),
  );

describe('detectLogoMimeType', () => {
  it('detects PNG, JPEG and WebP by their signatures', () => {
    expect(
      detectLogoMimeType(
        bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      ),
    ).toBe('image/png');
    expect(detectLogoMimeType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    );
    expect(
      detectLogoMimeType(bytes('RIFF', [0x24, 0x00, 0x00, 0x00], 'WEBPVP8 ')),
    ).toBe('image/webp');
  });

  it('rejects SVG, other RIFF files and truncated data', () => {
    expect(
      detectLogoMimeType(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBeNull();
    expect(
      detectLogoMimeType(bytes('RIFF', [0x24, 0x00, 0x00, 0x00], 'WAVEfmt ')),
    ).toBeNull();
    expect(detectLogoMimeType(bytes([0x89, 0x50, 0x4e]))).toBeNull();
    expect(detectLogoMimeType(new Uint8Array())).toBeNull();
  });
});
