export interface Brand {
  id: string;
  title: string;
  attributes?: Record<string, string>;
  classes?: string[];
  cssVariables?: Record<`--${string}`, string>;
}

export interface BrandsConfig {
  brands: Brand[];
  defaultBrand?: string;
  target?: string;
}

export interface BrandsParameters {
  allowed?: string[];
  default?: string;
  disabled?: boolean;
}
