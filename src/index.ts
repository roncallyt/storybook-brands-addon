import { definePreviewAddon } from 'storybook/internal/csf';

import addonAnnotations from './preview';

export { BRAND_GLOBAL, BRANDS_PARAMETER } from './constants';
export { withBrandsByClassName, withBrandsByDataAttribute } from './simpleActivation';
export type {
  Brand,
  BrandsConfig,
  BrandsParameters,
  ClassNameBrand,
  ClassNameBrandsConfig,
  DataAttributeBrand,
  DataAttributeBrandsConfig,
} from './types';
export { withBrands } from './withBrands';

export default () => definePreviewAddon(addonAnnotations);
