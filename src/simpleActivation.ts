import { fail, isRecord, requireAttributeName } from './config';
import type { BrandsConfig, ClassNameBrandsConfig, DataAttributeBrandsConfig } from './types';
import { withBrands } from './withBrands';

const ASCII_WHITESPACE = /[\t\n\f\r ]+/;

const requireConfig = (config: unknown): Record<string, unknown> => {
  if (!isRecord(config)) {
    return fail('config', 'expected an object');
  }
  if (!Array.isArray(config.brands) || config.brands.length === 0) {
    return fail('brands', 'expected a nonempty array');
  }

  return config;
};

const requireBrand = (brand: unknown, index: number): Record<string, unknown> => {
  if (!isRecord(brand)) {
    return fail(`brands[${index}]`, 'expected an object');
  }

  return brand;
};

const requireClassName = (value: unknown, path: string): string => {
  if (typeof value !== 'string') {
    return fail(path, 'expected one or more whitespace-separated class tokens');
  }

  return value;
};

const sharedConfig = (config: Record<string, unknown>, brands: BrandsConfig['brands']): BrandsConfig => ({
  brands,
  defaultBrand: config.defaultBrand as string | undefined,
  target: config.target as string | undefined,
});

export const withBrandsByDataAttribute = (config: DataAttributeBrandsConfig) => {
  const source = requireConfig(config);
  const attributeName =
    source.attributeName === undefined ? 'data-brand' : requireAttributeName(source.attributeName, 'attributeName');
  if (attributeName.toLowerCase() === 'class' || attributeName.toLowerCase() === 'style') {
    fail('attributeName', 'use withBrands() for class or style activation');
  }
  const brands = (source.brands as unknown[]).map((brandValue, index) => {
    const brand = requireBrand(brandValue, index);
    if (brand.value !== undefined && typeof brand.value !== 'string') {
      fail(`brands[${index}].value`, 'expected a string');
    }

    return {
      id: brand.id as string,
      title: brand.title as string,
      attributes: { [attributeName]: (brand.value ?? brand.id) as string },
    };
  });

  return withBrands(sharedConfig(source, brands));
};

export const withBrandsByClassName = (config: ClassNameBrandsConfig) => {
  const source = requireConfig(config);
  const brands = (source.brands as unknown[]).map((brandValue, index) => {
    const brand = requireBrand(brandValue, index);
    const classNamePath = `brands[${index}].className`;
    const classes = requireClassName(brand.className, classNamePath).split(ASCII_WHITESPACE).filter(Boolean);
    if (classes.length === 0) {
      fail(classNamePath, 'expected one or more whitespace-separated class tokens');
    }

    return {
      id: brand.id as string,
      title: brand.title as string,
      classes,
    };
  });

  return withBrands(sharedConfig(source, brands));
};
