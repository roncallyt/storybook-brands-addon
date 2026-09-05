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

export interface DataAttributeBrand {
  id: string;
  title: string;
  value?: string;
}

export interface DataAttributeBrandsConfig {
  brands: DataAttributeBrand[];
  defaultBrand?: string;
  target?: string;
  attributeName?: string;
}

export interface ClassNameBrand {
  id: string;
  title: string;
  className: string;
}

export interface ClassNameBrandsConfig {
  brands: ClassNameBrand[];
  defaultBrand?: string;
  target?: string;
}

export interface BrandsParameters {
  allowed?: string[];
  default?: string;
  disabled?: boolean;
  docs?: BrandsDocsParameters;
}

export interface BrandsDocsParameters {
  allowed?: string[];
  default?: string;
  disabled?: boolean;
}
