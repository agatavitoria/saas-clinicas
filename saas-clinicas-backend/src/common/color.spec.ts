import { contrastRatio, hasAccessibleContrast } from './color.js';

describe('color contrast', () => {
  it('is 21 between black and white and 1 between equal colors', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
    expect(contrastRatio('#00696B', '#00696b')).toBeCloseTo(1);
  });

  it('does not depend on the argument order', () => {
    expect(contrastRatio('#1565C0', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#1565C0'),
    );
  });

  it.each(['#00696B', '#1565C0', '#2E7D32', '#000000'])(
    'accepts %s as a primary color',
    (color) => {
      expect(hasAccessibleContrast(color)).toBe(true);
    },
  );

  it.each(['#FFFFFF', '#FFEB3B', '#4FC3F7', '#0288D1'])(
    'rejects %s, too light for white text',
    (color) => {
      expect(hasAccessibleContrast(color)).toBe(false);
    },
  );
});
