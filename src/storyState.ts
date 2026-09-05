import { ADDON_ID, BRAND_GLOBAL } from './constants';

export interface BrandReference {
  readonly id: string;
  readonly title: string;
}

export interface BrandCatalog<TBrand extends BrandReference> {
  readonly brands: readonly TBrand[];
  readonly defaultBrand: string | undefined;
}

export interface BrandSelectionMismatch {
  readonly source: 'story' | 'user';
  readonly value: unknown;
  readonly reason: 'invalid' | 'unknown' | 'disallowed';
}

export interface StoryBrandState<TBrand extends BrandReference> {
  readonly allowedBrands: readonly TBrand[];
  readonly brand: TBrand | undefined;
  readonly disabled: boolean;
  readonly locked: boolean;
  readonly mismatch: BrandSelectionMismatch | undefined;
}

interface NormalizedBrandsParameters<TBrand extends BrandReference> {
  readonly allowedBrands: readonly TBrand[];
  readonly allowedIds: ReadonlySet<string>;
  readonly defaultBrand: TBrand | undefined;
  readonly disabled: boolean;
}

type Globals = Readonly<Record<string, unknown>>;
type Warn = (message: string) => void;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const report = (warn: Warn, path: string, message: string): void => {
  warn(`[${ADDON_ID}] ${path}: ${message}`);
};

const normalizeBrandsParameters = <TBrand extends BrandReference>(
  catalog: BrandCatalog<TBrand>,
  value: unknown,
  warn: Warn,
  path = 'parameters.brands',
): NormalizedBrandsParameters<TBrand> => {
  let parameters: Record<string, unknown> = {};
  if (value !== undefined) {
    if (isRecord(value)) {
      parameters = value;
    } else {
      report(warn, path, 'expected an object; ignoring');
    }
  }

  const brandsById = new Map(catalog.brands.map((brand) => [brand.id, brand]));
  let allowedBrands = catalog.brands;

  if (parameters.allowed !== undefined) {
    if (!Array.isArray(parameters.allowed)) {
      report(warn, `${path}.allowed`, 'expected an array; ignoring restriction');
    } else {
      const allowedIds = new Set<string>();

      parameters.allowed.forEach((id, index) => {
        const entryPath = `${path}.allowed[${index}]`;
        if (typeof id !== 'string' || id.trim().length === 0) {
          report(warn, entryPath, 'expected a nonblank string; ignoring entry');
        } else if (allowedIds.has(id)) {
          report(warn, entryPath, `duplicate brand ID ${JSON.stringify(id)}; ignoring entry`);
        } else if (!brandsById.has(id)) {
          report(warn, entryPath, `unknown brand ID ${JSON.stringify(id)}; ignoring entry`);
        } else {
          allowedIds.add(id);
        }
      });

      if (allowedIds.size === 0) {
        report(warn, `${path}.allowed`, 'does not include any configured brands; ignoring restriction');
      } else {
        allowedBrands = catalog.brands.filter(({ id }) => allowedIds.has(id));
      }
    }
  }

  const allowedIds = new Set(allowedBrands.map(({ id }) => id));
  let defaultBrand: TBrand | undefined;

  if (parameters.default !== undefined) {
    if (typeof parameters.default !== 'string' || parameters.default.trim().length === 0) {
      report(warn, `${path}.default`, 'expected a nonblank string; ignoring');
    } else {
      const configuredDefault = brandsById.get(parameters.default);
      if (configuredDefault === undefined) {
        report(warn, `${path}.default`, `unknown brand ID ${JSON.stringify(parameters.default)}; ignoring`);
      } else if (!allowedIds.has(configuredDefault.id)) {
        report(
          warn,
          `${path}.default`,
          `brand ID ${JSON.stringify(parameters.default)} is excluded by ${path}.allowed; ignoring`,
        );
      } else {
        defaultBrand = configuredDefault;
      }
    }
  }

  let disabled = false;
  if (parameters.disabled !== undefined) {
    if (typeof parameters.disabled === 'boolean') {
      disabled = parameters.disabled;
    } else {
      report(warn, `${path}.disabled`, 'expected a boolean; ignoring');
    }
  }

  return { allowedBrands, allowedIds, defaultBrand, disabled };
};

const getDocsParameters = (value: unknown, warn: Warn): unknown => {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    report(warn, 'parameters.brands', 'expected an object; ignoring');
    return undefined;
  }
  return value.docs;
};

const resolveGlobal = <TBrand extends BrandReference>(
  brandsById: ReadonlyMap<string, TBrand>,
  value: unknown,
  source: BrandSelectionMismatch['source'],
  warn: Warn,
): { brand: TBrand | undefined; mismatch: BrandSelectionMismatch | undefined } => {
  const path = source === 'story' ? 'storyGlobals.brand' : 'globals.brand';
  if (typeof value !== 'string') {
    report(warn, path, 'expected a string; using fallback');
    return { brand: undefined, mismatch: { source, value, reason: 'invalid' } };
  }

  const brand = brandsById.get(value);
  if (brand === undefined) {
    report(warn, path, `unknown brand ID ${JSON.stringify(value)}; using fallback`);
    return { brand: undefined, mismatch: { source, value, reason: 'unknown' } };
  }

  return { brand, mismatch: undefined };
};

export const resolveStoryBrandState = <TBrand extends BrandReference>(
  catalog: BrandCatalog<TBrand>,
  parametersValue: unknown,
  storyGlobals: Globals,
  userGlobals: Globals,
  warn: Warn = console.warn,
): StoryBrandState<TBrand> => {
  const parameters = normalizeBrandsParameters(catalog, parametersValue, warn);
  const brandsById = new Map(catalog.brands.map((brand) => [brand.id, brand]));
  const locked = BRAND_GLOBAL in storyGlobals;

  if (parameters.disabled) {
    return {
      allowedBrands: parameters.allowedBrands,
      brand: undefined,
      disabled: true,
      locked,
      mismatch: undefined,
    };
  }

  let mismatch: BrandSelectionMismatch | undefined;

  if (locked) {
    const storySelection = resolveGlobal(brandsById, storyGlobals[BRAND_GLOBAL], 'story', warn);
    if (storySelection.brand !== undefined) {
      if (!parameters.allowedIds.has(storySelection.brand.id)) {
        report(
          warn,
          'storyGlobals.brand',
          `brand ID ${JSON.stringify(storySelection.brand.id)} is excluded by parameters.brands.allowed; using forced override`,
        );
      }

      return {
        allowedBrands: parameters.allowedBrands,
        brand: storySelection.brand,
        disabled: false,
        locked: true,
        mismatch: undefined,
      };
    }
    mismatch = storySelection.mismatch;
  }

  const userValue = userGlobals[BRAND_GLOBAL];
  if (userValue !== undefined) {
    const userSelection = resolveGlobal(brandsById, userValue, 'user', warn);
    if (userSelection.brand !== undefined && parameters.allowedIds.has(userSelection.brand.id)) {
      return {
        allowedBrands: parameters.allowedBrands,
        brand: userSelection.brand,
        disabled: false,
        locked,
        mismatch,
      };
    }

    if (mismatch === undefined) {
      mismatch = userSelection.mismatch ?? ({ source: 'user', value: userValue, reason: 'disallowed' } as const);
    }
  }

  const projectDefault = catalog.defaultBrand === undefined ? undefined : brandsById.get(catalog.defaultBrand);
  const brand =
    parameters.defaultBrand ??
    (projectDefault !== undefined && parameters.allowedIds.has(projectDefault.id) ? projectDefault : undefined) ??
    parameters.allowedBrands[0];

  return {
    allowedBrands: parameters.allowedBrands,
    brand,
    disabled: false,
    locked,
    mismatch,
  };
};

export const resolveDocsBrandState = <TBrand extends BrandReference>(
  catalog: BrandCatalog<TBrand>,
  parametersValue: unknown,
  userGlobals: Globals,
  warn: Warn = console.warn,
): StoryBrandState<TBrand> => {
  const parameters = normalizeBrandsParameters(
    catalog,
    getDocsParameters(parametersValue, warn),
    warn,
    'parameters.brands.docs',
  );
  const brandsById = new Map(catalog.brands.map((brand) => [brand.id, brand]));

  if (parameters.disabled) {
    return {
      allowedBrands: parameters.allowedBrands,
      brand: undefined,
      disabled: true,
      locked: false,
      mismatch: undefined,
    };
  }

  let mismatch: BrandSelectionMismatch | undefined;
  const userValue = userGlobals[BRAND_GLOBAL];
  if (userValue !== undefined) {
    const userSelection = resolveGlobal(brandsById, userValue, 'user', warn);
    if (userSelection.brand !== undefined && parameters.allowedIds.has(userSelection.brand.id)) {
      return {
        allowedBrands: parameters.allowedBrands,
        brand: userSelection.brand,
        disabled: false,
        locked: false,
        mismatch: undefined,
      };
    }
    mismatch = userSelection.mismatch ?? { source: 'user', value: userValue, reason: 'disallowed' };
  }

  const projectDefault = catalog.defaultBrand === undefined ? undefined : brandsById.get(catalog.defaultBrand);
  const brand =
    parameters.defaultBrand ??
    (projectDefault !== undefined && parameters.allowedIds.has(projectDefault.id) ? projectDefault : undefined) ??
    parameters.allowedBrands[0];

  return {
    allowedBrands: parameters.allowedBrands,
    brand,
    disabled: false,
    locked: false,
    mismatch,
  };
};
