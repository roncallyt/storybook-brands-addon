import { useEffect } from 'storybook/preview-api';
import type { DecoratorFunction, Renderer } from 'storybook/internal/types';

import { BRAND_GLOBAL } from './constants';
import { normalizeBrandsConfig, resolveBrand } from './config';
import { applyBrand } from './dom';
import type { BrandsConfig } from './types';

export const withBrands = (config: BrandsConfig): DecoratorFunction<Renderer> => {
  const normalizedConfig = normalizeBrandsConfig(config);

  return (Story, context) => {
    const globalBrand: unknown = context.globals[BRAND_GLOBAL];
    const canvasElement = context.canvasElement;
    const viewMode = context.viewMode;

    useEffect(() => {
      if (viewMode !== 'story') {
        return undefined;
      }

      const brand = resolveBrand(normalizedConfig, globalBrand);
      return applyBrand(canvasElement, normalizedConfig, brand);
    }, [canvasElement, globalBrand, viewMode]);

    return Story();
  };
};
