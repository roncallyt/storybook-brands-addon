import { useChannel, useEffect, useState } from 'storybook/preview-api';
import type { DecoratorFunction, Renderer } from 'storybook/internal/types';

import {
  BRAND_GLOBAL,
  BRANDS_PARAMETER,
  DOCS_CONTEXT_EVENT,
  DOCS_CONTEXT_REQUEST_EVENT,
  DOCS_PARAMETERS_EVENT,
  REGISTER_EVENT,
  REQUEST_EVENT,
} from './constants';
import { normalizeBrandsConfig } from './config';
import { applyBrand } from './dom';
import { createBrandsRegistration, type DocsBrandContext } from './protocol';
import { resolveStoryBrandState } from './storyState';
import type { BrandsConfig } from './types';

const sameDocsContext = (left: DocsBrandContext | undefined, right: DocsBrandContext): boolean =>
  left?.pageId === right.pageId &&
  left.ownerComponentId === right.ownerComponentId &&
  left.supported === right.supported &&
  left.disabled === right.disabled &&
  left.brandId === right.brandId;

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
    const [docsContext, setDocsContext] = useState<DocsBrandContext | undefined>(undefined);
    const emit = useChannel(
      {
        [DOCS_CONTEXT_EVENT]: (nextContext: DocsBrandContext) =>
          setDocsContext((currentContext) =>
            sameDocsContext(currentContext, nextContext) ? currentContext : nextContext,
          ),
        [REQUEST_EVENT]: () => emit(REGISTER_EVENT, registration),
      },
      [registration],
    );

    emit(REGISTER_EVENT, registration);

    useEffect(() => {
      if (viewMode === 'docs') {
        emit(DOCS_CONTEXT_REQUEST_EVENT);
        const pageId = canvasElement.ownerDocument.defaultView
          ? new URLSearchParams(canvasElement.ownerDocument.defaultView.location.search).get('id')
          : null;
        if (
          pageId !== null &&
          docsContext?.pageId === pageId &&
          docsContext.supported &&
          docsContext.ownerComponentId === context.componentId
        ) {
          emit(DOCS_PARAMETERS_EVENT, {
            pageId,
            componentId: context.componentId,
            parameters,
          });
        }
      }
      return undefined;
    }, [canvasElement, context.componentId, docsContext, parameters, viewMode]);

    useEffect(() => {
      if (viewMode === 'docs') {
        const pageId = canvasElement.ownerDocument.defaultView
          ? new URLSearchParams(canvasElement.ownerDocument.defaultView.location.search).get('id')
          : null;
        if (
          pageId === null ||
          docsContext?.pageId !== pageId ||
          !docsContext.supported ||
          docsContext.disabled ||
          docsContext.brandId === undefined
        ) {
          return undefined;
        }
        const brand = normalizedConfig.brandsById.get(docsContext.brandId);
        return brand === undefined ? undefined : applyBrand(canvasElement, normalizedConfig, brand);
      }

      if (viewMode !== 'story') {
        return undefined;
      }

      const state = resolveStoryBrandState(normalizedConfig, parameters, storyGlobals, userGlobals);
      if (state.disabled || state.brand === undefined) {
        return undefined;
      }

      return applyBrand(canvasElement, normalizedConfig, state.brand);
    }, [canvasElement, docsContext, parameters, storyGlobals, userGlobals, viewMode]);

    return Story();
  };
};
