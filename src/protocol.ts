import type { NormalizedBrandsConfig } from './config';

export interface RegisteredBrand {
  readonly id: string;
  readonly title: string;
}

export interface BrandsRegistration {
  readonly brands: readonly RegisteredBrand[];
  readonly defaultBrand: string | undefined;
}

export const createBrandsRegistration = (config: NormalizedBrandsConfig): BrandsRegistration => ({
  brands: config.brands.map(({ id, title }) => ({ id, title })),
  defaultBrand: config.defaultBrand,
});
