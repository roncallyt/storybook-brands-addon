import { describe, expect, it, vi } from 'vitest';

import { BRAND_GLOBAL } from './constants';
import { resolveDocsBrandState, resolveStoryBrandState, type BrandCatalog, type BrandReference } from './storyState';

const brand = (id: string, title: string): BrandReference => ({ id, title });
const catalog: BrandCatalog<BrandReference> = {
  brands: [
    brand('first', 'First'),
    brand('project', 'Project'),
    brand('selected', 'Selected'),
    brand('forced', 'Forced'),
  ],
  defaultBrand: 'project',
};

const resolve = (
  parameters: unknown = undefined,
  storyGlobals: Record<string, unknown> = {},
  userGlobals: Record<string, unknown> = {},
  warn = vi.fn(),
) => resolveStoryBrandState(catalog, parameters, storyGlobals, userGlobals, warn);

describe('per-story brand state', () => {
  it('resolves story globals before user globals and locks the result', () => {
    const state = resolve(undefined, { [BRAND_GLOBAL]: 'forced' }, { [BRAND_GLOBAL]: 'selected' });

    expect(state.brand?.id).toBe('forced');
    expect(state.locked).toBe(true);
    expect(state.mismatch).toBeUndefined();
  });

  it('resolves user, story-default, project-default, and first-brand precedence', () => {
    expect(resolve(undefined, {}, { [BRAND_GLOBAL]: 'selected' }).brand?.id).toBe('selected');
    expect(resolve({ default: 'first' }).brand?.id).toBe('first');
    expect(resolve().brand?.id).toBe('project');

    const withoutDefaults = { ...catalog, defaultBrand: undefined };
    expect(resolveStoryBrandState(withoutDefaults, undefined, {}, {}).brand?.id).toBe('first');
  });

  it('filters allowed brands in project catalog order and constrains defaults', () => {
    const state = resolve({ allowed: ['forced', 'first'], default: 'forced' });

    expect(state.allowedBrands.map(({ id }) => id)).toEqual(['first', 'forced']);
    expect(state.brand?.id).toBe('forced');
  });

  it('temporarily falls back for a disallowed saved selection without warning', () => {
    const warn = vi.fn();
    const userGlobals = { [BRAND_GLOBAL]: 'selected' };
    const state = resolve({ allowed: ['first', 'forced'] }, {}, userGlobals, warn);

    expect(state.brand?.id).toBe('first');
    expect(state.mismatch).toEqual({ source: 'user', value: 'selected', reason: 'disallowed' });
    expect(userGlobals[BRAND_GLOBAL]).toBe('selected');
    expect(warn).not.toHaveBeenCalled();
  });

  it('lets a hard story override win outside the allowed set and warns', () => {
    const warn = vi.fn();
    const state = resolve({ allowed: ['first'] }, { [BRAND_GLOBAL]: 'forced' }, {}, warn);

    expect(state.brand?.id).toBe('forced');
    expect(state.locked).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toMatch(
      /^\[storybook-brands-addon\] storyGlobals\.brand: .*excluded.*forced override$/,
    );
  });

  it('keeps an invalid story override locked while applying a fallback', () => {
    const warn = vi.fn();
    const state = resolve(undefined, { [BRAND_GLOBAL]: 'missing' }, {}, warn);

    expect(state.brand?.id).toBe('project');
    expect(state.locked).toBe(true);
    expect(state.mismatch).toEqual({ source: 'story', value: 'missing', reason: 'unknown' });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('disables application before resolving any global', () => {
    const warn = vi.fn();
    const state = resolve(
      { disabled: true, allowed: ['first'] },
      { [BRAND_GLOBAL]: 'forced' },
      { [BRAND_GLOBAL]: 'selected' },
      warn,
    );

    expect(state.brand).toBeUndefined();
    expect(state.disabled).toBe(true);
    expect(state.locked).toBe(true);
    expect(state.allowedBrands.map(({ id }) => id)).toEqual(['first']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns and ignores an empty or wholly unknown allowed restriction', () => {
    const emptyWarn = vi.fn();
    const empty = resolve({ allowed: [] }, {}, { [BRAND_GLOBAL]: 'selected' }, emptyWarn);
    expect(empty.allowedBrands).toEqual(catalog.brands);
    expect(empty.brand?.id).toBe('selected');
    expect(emptyWarn).toHaveBeenCalledOnce();

    const unknownWarn = vi.fn();
    const unknown = resolve({ allowed: ['missing'] }, {}, { [BRAND_GLOBAL]: 'selected' }, unknownWarn);
    expect(unknown.allowedBrands).toEqual(catalog.brands);
    expect(unknown.brand?.id).toBe('selected');
    expect(unknownWarn).toHaveBeenCalledTimes(2);
  });

  it('uses valid allowed entries while warning about malformed, duplicate, and unknown metadata', () => {
    const warn = vi.fn();
    const state = resolve(
      { allowed: ['selected', 'selected', 'missing', 42], default: 'project', disabled: 'yes' },
      {},
      {},
      warn,
    );

    expect(state.allowedBrands.map(({ id }) => id)).toEqual(['selected']);
    expect(state.brand?.id).toBe('selected');
    expect(state.disabled).toBe(false);
    expect(warn).toHaveBeenCalledTimes(5);
    expect(warn.mock.calls.every(([message]) => /^\[storybook-brands-addon\]/.test(message as string))).toBe(true);
  });

  it('warns and ignores a malformed parameter object and invalid saved global', () => {
    const warn = vi.fn();
    const state = resolve(null, {}, { [BRAND_GLOBAL]: 42 }, warn);

    expect(state.brand?.id).toBe('project');
    expect(state.mismatch).toEqual({ source: 'user', value: 42, reason: 'invalid' });
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('component Docs brand state', () => {
  it('resolves user, Docs default, project default, and first allowed brand precedence', () => {
    expect(resolveDocsBrandState(catalog, undefined, { [BRAND_GLOBAL]: 'selected' }).brand?.id).toBe('selected');
    expect(resolveDocsBrandState(catalog, { docs: { default: 'first' } }, {}).brand?.id).toBe('first');
    expect(resolveDocsBrandState(catalog, undefined, {}).brand?.id).toBe('project');
    expect(resolveDocsBrandState({ ...catalog, defaultBrand: undefined }, undefined, {}).brand?.id).toBe('first');
  });

  it('uses only nested Docs controls and preserves a disallowed saved selection', () => {
    const userGlobals = { [BRAND_GLOBAL]: 'selected' };
    const state = resolveDocsBrandState(
      catalog,
      {
        allowed: ['selected'],
        default: 'selected',
        disabled: true,
        docs: { allowed: ['first', 'forced'], default: 'forced' },
      },
      userGlobals,
    );

    expect(state.allowedBrands.map(({ id }) => id)).toEqual(['first', 'forced']);
    expect(state.brand?.id).toBe('forced');
    expect(state.locked).toBe(false);
    expect(state.mismatch).toEqual({ source: 'user', value: 'selected', reason: 'disallowed' });
    expect(userGlobals[BRAND_GLOBAL]).toBe('selected');
  });

  it('disables Docs before resolving globals', () => {
    const warn = vi.fn();
    const state = resolveDocsBrandState(
      catalog,
      { docs: { disabled: true, allowed: ['first'] } },
      { [BRAND_GLOBAL]: 42 },
      warn,
    );

    expect(state.brand).toBeUndefined();
    expect(state.disabled).toBe(true);
    expect(state.locked).toBe(false);
    expect(state.allowedBrands.map(({ id }) => id)).toEqual(['first']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns with Docs paths and falls back for malformed metadata', () => {
    const warn = vi.fn();
    const state = resolveDocsBrandState(
      catalog,
      { docs: { allowed: ['missing'], default: 'missing', disabled: 'yes' } },
      {},
      warn,
    );

    expect(state.brand?.id).toBe('project');
    expect(warn).toHaveBeenCalledTimes(4);
    expect(
      warn.mock.calls.every(([message]) => /^\[storybook-brands-addon\] parameters\.brands\.docs/.test(message)),
    ).toBe(true);
  });

  it('warns about a malformed outer or nested parameter object', () => {
    const outerWarn = vi.fn();
    const nestedWarn = vi.fn();

    expect(resolveDocsBrandState(catalog, null, {}, outerWarn).brand?.id).toBe('project');
    expect(resolveDocsBrandState(catalog, { docs: false }, {}, nestedWarn).brand?.id).toBe('project');
    expect(outerWarn).toHaveBeenCalledWith(expect.stringContaining('parameters.brands:'));
    expect(nestedWarn).toHaveBeenCalledWith(expect.stringContaining('parameters.brands.docs:'));
  });
});
