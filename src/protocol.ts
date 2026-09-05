import type { NormalizedBrandsConfig } from './config';

export interface RegisteredBrand {
  readonly id: string;
  readonly title: string;
}

export interface BrandsRegistration {
  readonly brands: readonly RegisteredBrand[];
  readonly defaultBrand: string | undefined;
}

export interface DocsBrandContext {
  readonly pageId: string;
  readonly ownerComponentId: string | undefined;
  readonly supported: boolean;
  readonly disabled: boolean;
  readonly brandId: string | undefined;
}

export interface DocsParametersReport {
  readonly pageId: string;
  readonly componentId: string;
  readonly parameters: unknown;
}

export const createBrandsRegistration = (config: NormalizedBrandsConfig): BrandsRegistration => ({
  brands: config.brands.map(({ id, title }) => ({ id, title })),
  defaultBrand: config.defaultBrand,
});
