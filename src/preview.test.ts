import { describe, expect, it } from 'vitest';

import { BRAND_GLOBAL } from './constants';
import preview from './preview';

describe('preview annotations', () => {
  it('registers the brand global so Storybook accepts manager updates', () => {
    expect(preview.globalTypes).toHaveProperty(BRAND_GLOBAL);
  });
});
