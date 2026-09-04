import { useChannel, useEffect } from 'storybook/preview-api';
import type { DecoratorFunction, Renderer } from 'storybook/internal/types';

import { BRAND_GLOBAL, BRANDS_PARAMETER, REGISTER_EVENT, REQUEST_EVENT } from './constants';
import { normalizeBrandsConfig } from './config';
import { applyBrand } from './dom';
import { createBrandsRegistration } from './protocol';
import { resolveStoryBrandState } from './storyState';
import type { BrandsConfig } from './types';

export const withBrands = (config: BrandsConfig): DecoratorFunction<Renderer> => {
  const normalizedConfig = normalizeBrandsConfig(config);
  const registration = createBrandsRegistration(normalizedConfig);

  return (Story, context) => {
    const globalBrand: unknown = context.globals[BRAND_GLOBAL];
    const canvasElement = context.canvasElement;
    const parameters: unknown = context.parameters[BRANDS_PARAMETER];
    const storyGlobals = (context.storyGlobals ?? {}) as Record<string, unknown>;
    const userGlobals = (context.userGlobals ??
      (BRAND_GLOBAL in storyGlobals ? {} : { [BRAND_GLOBAL]: globalBrand })) as Record<string, unknown>;
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

      const state = resolveStoryBrandState(normalizedConfig, parameters, storyGlobals, userGlobals);
      if (state.disabled || state.brand === undefined) {
        return undefined;
      }

      return applyBrand(canvasElement, normalizedConfig, state.brand);
    }, [canvasElement, parameters, storyGlobals, userGlobals, viewMode]);

    return Story();
  };
};
