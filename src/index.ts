import { definePreviewAddon } from 'storybook/internal/csf';

import addonAnnotations from './preview';

export { BRAND_GLOBAL, BRANDS_PARAMETER } from './constants';
export type { Brand, BrandsConfig, BrandsParameters } from './types';
export { withBrands } from './withBrands';

export default () => definePreviewAddon(addonAnnotations);
