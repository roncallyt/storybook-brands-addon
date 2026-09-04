import { useChannel, useEffect } from 'storybook/preview-api';
import type { DecoratorFunction, Renderer } from 'storybook/internal/types';

import { BRAND_GLOBAL, REGISTER_EVENT, REQUEST_EVENT } from './constants';
import { normalizeBrandsConfig, resolveBrand } from './config';
import { applyBrand } from './dom';
import { createBrandsRegistration } from './protocol';
import type { BrandsConfig } from './types';

export const withBrands = (config: BrandsConfig): DecoratorFunction<Renderer> => {
  const normalizedConfig = normalizeBrandsConfig(config);
  const registration = createBrandsRegistration(normalizedConfig);

  return (Story, context) => {
    const globalBrand: unknown = context.globals[BRAND_GLOBAL];
    const canvasElement = context.canvasElement;
    const viewMode = context.viewMode;
    const emit = useChannel(
      {
        [REQUEST_EVENT]: () => emit(REGISTER_EVENT, registration),
      },
      [registration],
    );

    emit(REGISTER_EVENT, registration);

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
