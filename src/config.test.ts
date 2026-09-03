import { describe, expect, it, vi } from 'vitest';

import { normalizeBrandsConfig, resolveBrand } from './config';
import type { BrandsConfig } from './types';
import { withBrands } from './withBrands';

const brand = (id = 'alpha', title = 'Alpha') => ({ id, title });

const invalidConfig = (config: unknown, path: string): void => {
  expect(() => withBrands(config as BrandsConfig)).toThrowError(
    new RegExp(`^\\[storybook-brands-addon\\] ${path.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`),
  );
};

describe('brand configuration validation', () => {
  it('requires a configuration object and a nonempty brand catalog', () => {
    invalidConfig(null, 'config');
    invalidConfig({}, 'brands');
    invalidConfig({ brands: [] }, 'brands');
    invalidConfig({ brands: 'alpha' }, 'brands');
  });

  it('requires brand objects with unique, nonblank string IDs', () => {
    invalidConfig({ brands: [null] }, 'brands[0]');
    invalidConfig({ brands: [brand('')] }, 'brands[0].id');
    invalidConfig({ brands: [brand('   ')] }, 'brands[0].id');
    invalidConfig({ brands: [brand('same'), brand('same', 'Other')] }, 'brands[1].id');
  });

  it('preserves IDs exactly instead of trimming or slugifying them', () => {
    const config = normalizeBrandsConfig({ brands: [brand(' alpha / beta ', 'Spaced')] });

    expect(config.brands[0]?.id).toBe(' alpha / beta ');
    expect(config.brandsById.has(' alpha / beta ')).toBe(true);
  });

  it('requires nonblank titles', () => {
    invalidConfig({ brands: [brand('alpha', '')] }, 'brands[0].title');
    invalidConfig({ brands: [brand('alpha', ' \t ')] }, 'brands[0].title');
  });

  it('validates attribute maps, names, reserved names, and values', () => {
    invalidConfig({ brands: [{ ...brand(), attributes: [] }] }, 'brands[0].attributes');
    invalidConfig(
      { brands: [{ ...brand(), attributes: { 'invalid name': 'value' } }] },
      'brands[0].attributes.invalid name',
    );
    invalidConfig({ brands: [{ ...brand(), attributes: { class: 'alpha' } }] }, 'brands[0].attributes.class');
    invalidConfig({ brands: [{ ...brand(), attributes: { STYLE: 'color: red' } }] }, 'brands[0].attributes.STYLE');
    invalidConfig({ brands: [{ ...brand(), attributes: { 'data-brand': 1 } }] }, 'brands[0].attributes.data-brand');

    const unicode = normalizeBrandsConfig({
      brands: [{ ...brand(), attributes: { 'dáta-brand': 'alpha' } }],
    });
    expect(unicode.brands[0]?.attributes['dáta-brand']).toBe('alpha');
  });

  it('requires classes to be individual nonempty DOM tokens', () => {
    invalidConfig({ brands: [{ ...brand(), classes: 'alpha' }] }, 'brands[0].classes');
    invalidConfig({ brands: [{ ...brand(), classes: [''] }] }, 'brands[0].classes[0]');
    invalidConfig({ brands: [{ ...brand(), classes: ['alpha beta'] }] }, 'brands[0].classes[0]');
    invalidConfig({ brands: [{ ...brand(), classes: ['alpha\nbeta'] }] }, 'brands[0].classes[0]');
  });

  it('validates CSS custom-property maps, names, and string values', () => {
    invalidConfig({ brands: [{ ...brand(), cssVariables: [] }] }, 'brands[0].cssVariables');
    invalidConfig({ brands: [{ ...brand(), cssVariables: { color: 'red' } }] }, 'brands[0].cssVariables.color');
    invalidConfig(
      { brands: [{ ...brand(), cssVariables: { '--brand color': 'red' } }] },
      'brands[0].cssVariables.--brand color',
    );
    invalidConfig(
      { brands: [{ ...brand(), cssVariables: { '--brand-color': 42 } }] },
      'brands[0].cssVariables.--brand-color',
    );
  });

  it('requires valid defaults and nonblank supplied targets', () => {
    invalidConfig({ brands: [brand()], defaultBrand: '' }, 'defaultBrand');
    invalidConfig({ brands: [brand()], defaultBrand: 'missing' }, 'defaultBrand');
    invalidConfig({ brands: [brand()], target: '  ' }, 'target');
  });

  it('snapshots all nested configuration values synchronously', () => {
    const config: BrandsConfig = {
      brands: [
        {
          ...brand(),
          attributes: { 'data-brand': 'alpha' },
          classes: ['alpha'],
          cssVariables: { '--brand-color': 'red' },
        },
      ],
      defaultBrand: 'alpha',
      target: '#root',
    };
    const normalized = normalizeBrandsConfig(config);

    config.brands[0]!.id = 'changed';
    config.brands[0]!.attributes!['data-brand'] = 'changed';
    config.brands[0]!.classes![0] = 'changed';
    config.brands[0]!.cssVariables!['--brand-color'] = 'blue';
    config.target = 'html';

    expect(normalized.brands[0]).toEqual({
      id: 'alpha',
      title: 'Alpha',
      attributes: { 'data-brand': 'alpha' },
      classes: ['alpha'],
      cssVariables: { '--brand-color': 'red' },
    });
    expect(normalized.target).toBe('#root');
  });
});

describe('effective brand resolution', () => {
  const config = normalizeBrandsConfig({
    brands: [brand('first', 'First'), brand('project', 'Project'), brand('selected', 'Selected')],
    defaultBrand: 'project',
  });

  it('prefers a valid global selection', () => {
    expect(resolveBrand(config, 'selected').id).toBe('selected');
  });

  it('uses the project default when there is no selection', () => {
    expect(resolveBrand(config, undefined).id).toBe('project');
  });

  it('uses the first brand when there is no project default', () => {
    const catalog = normalizeBrandsConfig({ brands: [brand('one'), brand('two'), brand('three')] });
    expect(resolveBrand(catalog, undefined).id).toBe('one');
  });

  it.each([['missing'], [42], [null], [{}]])(
    'warns and falls back for unknown or non-string globals (%j)',
    (selection) => {
      const warn = vi.fn();
      expect(resolveBrand(config, selection, warn).id).toBe('project');
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0]?.[0]).toMatch(/^\[storybook-brands-addon\] globals\.brand:/);
    },
  );

  it.each([
    [['only'], 'only'],
    [['one', 'two'], 'two'],
    [['one', 'two', 'three', 'four'], 'four'],
  ])('supports arbitrary catalog sizes', (ids, selection) => {
    const catalog = normalizeBrandsConfig({ brands: ids.map((id) => brand(id, id)) });
    expect(resolveBrand(catalog, selection).id).toBe(selection);
  });
});
