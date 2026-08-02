import { describe, expect, it } from 'vitest';

import { hexToHslChannels } from './branding-provider';

describe('hexToHslChannels', () => {
  it.each([
    ['#FF0000', '0 100% 50%'],
    ['#00FF00', '120 100% 50%'],
    ['#0000FF', '240 100% 50%'],
    ['#FFFFFF', '0 0% 100%'],
    ['#000000', '0 0% 0%'],
  ])('converte %s para %s', (hex, expected) => {
    expect(hexToHslChannels(hex)).toBe(expected);
  });
});
