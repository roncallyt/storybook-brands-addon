import { ADDON_ID, BRAND_GLOBAL } from './constants';
import { resolveStoryBrandState } from './storyState';
import type { BrandsConfig } from './types';

export interface NormalizedBrand {
  readonly id: string;
  readonly title: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly classes: readonly string[];
  readonly cssVariables: Readonly<Record<`--${string}`, string>>;
}

export interface NormalizedBrandsConfig {
  readonly brands: readonly NormalizedBrand[];
  readonly brandsById: ReadonlyMap<string, NormalizedBrand>;
  readonly defaultBrand: string | undefined;
  readonly target: string;
  readonly attributeNames: readonly string[];
}

export const fail = (path: string, message: string): never => {
  throw new TypeError(`[${ADDON_ID}] ${path}: ${message}`);
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireNonblankString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail(path, 'expected a nonblank string');
  }

  return value;
};

// Element#setAttribute follows the XML Name production, even in HTML documents.
const isXmlNameStart = (codePoint: number): boolean =>
  codePoint === 0x3a ||
  codePoint === 0x5f ||
  (codePoint >= 0x41 && codePoint <= 0x5a) ||
  (codePoint >= 0x61 && codePoint <= 0x7a) ||
  (codePoint >= 0xc0 && codePoint <= 0xd6) ||
  (codePoint >= 0xd8 && codePoint <= 0xf6) ||
  (codePoint >= 0xf8 && codePoint <= 0x2ff) ||
  (codePoint >= 0x370 && codePoint <= 0x37d) ||
  (codePoint >= 0x37f && codePoint <= 0x1fff) ||
  (codePoint >= 0x200c && codePoint <= 0x200d) ||
  (codePoint >= 0x2070 && codePoint <= 0x218f) ||
  (codePoint >= 0x2c00 && codePoint <= 0x2fef) ||
  (codePoint >= 0x3001 && codePoint <= 0xd7ff) ||
  (codePoint >= 0xf900 && codePoint <= 0xfdcf) ||
  (codePoint >= 0xfdf0 && codePoint <= 0xfffd) ||
  (codePoint >= 0x10000 && codePoint <= 0xeffff);

const isXmlNameCharacter = (codePoint: number): boolean =>
  isXmlNameStart(codePoint) ||
  codePoint === 0x2d ||
  codePoint === 0x2e ||
  codePoint === 0xb7 ||
  (codePoint >= 0x30 && codePoint <= 0x39) ||
  (codePoint >= 0x300 && codePoint <= 0x36f) ||
  (codePoint >= 0x203f && codePoint <= 0x2040);

const isValidAttributeName = (name: string): boolean => {
  const codePoints = [...name].map((character) => character.codePointAt(0) as number);
  return (
    codePoints.length > 0 && isXmlNameStart(codePoints[0] as number) && codePoints.slice(1).every(isXmlNameCharacter)
  );
};

export const requireAttributeName = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || !isValidAttributeName(value)) {
    return fail(path, 'invalid attribute name');
  }

  return value;
};

const isCssNameCodePoint = (character: string): boolean => {
  const codePoint = character.codePointAt(0);
  return (
    character === '-' ||
    character === '_' ||
    (character >= '0' && character <= '9') ||
    (character >= 'A' && character <= 'Z') ||
    (character >= 'a' && character <= 'z') ||
    (codePoint !== undefined && codePoint >= 0x80)
  );
};

const isValidCssEscape = (value: string, index: number): number => {
  const escaped = value[index + 1];
  if (escaped === undefined || escaped === '\n' || escaped === '\r' || escaped === '\f') {
    return -1;
  }

  if (!/[0-9A-Fa-f]/.test(escaped)) {
    return index + 2;
  }

  let next = index + 1;
  let digits = 0;
  while (next < value.length && digits < 6 && /[0-9A-Fa-f]/.test(value[next] ?? '')) {
    next += 1;
    digits += 1;
  }

  if (/[\t\n\f\r ]/.test(value[next] ?? '')) {
    next += 1;
  }

  return next;
};

const isValidCssCustomPropertyName = (name: string): name is `--${string}` => {
  if (!name.startsWith('--') || name.length === 2) {
    return false;
  }

  for (let index = 2; index < name.length; ) {
    const character = name[index];
    if (character === '\\') {
      const next = isValidCssEscape(name, index);
      if (next === -1) {
        return false;
      }
      index = next;
      continue;
    }

    if (character === undefined || !isCssNameCodePoint(character)) {
      return false;
    }

    index += character.length;
  }

  return true;
};

const normalizeAttributes = (value: unknown, path: string): Record<string, string> => {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    return fail(path, 'expected an object');
  }

  const normalized = Object.create(null) as Record<string, string>;
  for (const [name, attributeValue] of Object.entries(value)) {
    const propertyPath = `${path}.${name || '<empty>'}`;
    requireAttributeName(name, propertyPath);
    if (name.toLowerCase() === 'class' || name.toLowerCase() === 'style') {
      fail(propertyPath, 'use classes or cssVariables instead');
    }
    if (typeof attributeValue !== 'string') {
      return fail(propertyPath, 'expected a string');
    }
    normalized[name] = attributeValue;
  }

  return normalized;
};

const normalizeClasses = (value: unknown, path: string): string[] => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return fail(path, 'expected an array');
  }

  return value.map((className, index) => {
    const propertyPath = `${path}[${index}]`;
    if (typeof className !== 'string' || className.length === 0 || /[\t\n\f\r ]/.test(className)) {
      return fail(propertyPath, 'expected one nonempty whitespace-free DOM token');
    }
    return className;
  });
};

const normalizeCssVariables = (value: unknown, path: string): Record<`--${string}`, string> => {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    return fail(path, 'expected an object');
  }

  const normalized: Partial<Record<`--${string}`, string>> = {};
  for (const [name, cssValue] of Object.entries(value)) {
    const propertyPath = `${path}.${name || '<empty>'}`;
    if (!isValidCssCustomPropertyName(name)) {
      return fail(propertyPath, 'invalid CSS custom-property name');
    }
    if (typeof cssValue !== 'string') {
      return fail(propertyPath, 'expected a string');
    }
    normalized[name] = cssValue;
  }

  return normalized as Record<`--${string}`, string>;
};

export const normalizeBrandsConfig = (config: BrandsConfig): NormalizedBrandsConfig => {
  if (!isRecord(config)) {
    return fail('config', 'expected an object');
  }
  if (!Array.isArray(config.brands) || config.brands.length === 0) {
    return fail('brands', 'expected a nonempty array');
  }

  const brands: NormalizedBrand[] = [];
  const brandsById = new Map<string, NormalizedBrand>();
  const attributeNames = new Set<string>();

  for (const [index, value] of config.brands.entries()) {
    const path = `brands[${index}]`;
    if (!isRecord(value)) {
      fail(path, 'expected an object');
    }

    const id = requireNonblankString(value.id, `${path}.id`);
    if (brandsById.has(id)) {
      fail(`${path}.id`, `duplicate brand ID ${JSON.stringify(id)}`);
    }

    const attributes = normalizeAttributes(value.attributes, `${path}.attributes`);
    const brand: NormalizedBrand = {
      id,
      title: requireNonblankString(value.title, `${path}.title`),
      attributes,
      classes: normalizeClasses(value.classes, `${path}.classes`),
      cssVariables: normalizeCssVariables(value.cssVariables, `${path}.cssVariables`),
    };

    brands.push(brand);
    brandsById.set(id, brand);
    Object.keys(attributes).forEach((name) => attributeNames.add(name));
  }

  let defaultBrand: string | undefined;
  if (config.defaultBrand !== undefined) {
    defaultBrand = requireNonblankString(config.defaultBrand, 'defaultBrand');
    if (!brandsById.has(defaultBrand)) {
      fail('defaultBrand', `unknown brand ID ${JSON.stringify(defaultBrand)}`);
    }
  }

  const target = config.target === undefined ? 'html' : requireNonblankString(config.target, 'target');

  return {
    brands,
    brandsById,
    defaultBrand,
    target,
    attributeNames: [...attributeNames],
  };
};

export const resolveBrand = (
  config: NormalizedBrandsConfig,
  globalBrand: unknown,
  warn: (message: string) => void = console.warn,
): NormalizedBrand => {
  const userGlobals = globalBrand === undefined ? {} : { [BRAND_GLOBAL]: globalBrand };
  const fallback = resolveStoryBrandState(config, undefined, {}, userGlobals, warn).brand;

  // Validation guarantees a nonempty catalog and a valid default.
  return fallback as NormalizedBrand;
};
