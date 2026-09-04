import { beforeEach, describe, expect, it, vi } from 'vitest';

const hook = vi.hoisted(() => ({
  cleanup: undefined as (() => void) | undefined,
  emit: vi.fn(),
  listeners: {} as Record<string, (...args: unknown[]) => void>,
  useEffect: vi.fn<(create: () => (() => void) | undefined) => void>(),
  useChannel: vi.fn((listeners: Record<string, (...args: unknown[]) => void>) => {
    hook.listeners = listeners;
    return hook.emit;
  }),
}));

vi.mock('storybook/preview-api', () => ({
  useChannel: hook.useChannel,
  useEffect: hook.useEffect,
}));

import type { StoryContext } from 'storybook/internal/types';

import { BRAND_GLOBAL, BRANDS_PARAMETER, REGISTER_EVENT } from './constants';
import { withBrandsByClassName, withBrandsByDataAttribute } from './simpleActivation';
import type { ClassNameBrandsConfig, DataAttributeBrandsConfig } from './types';

type ActivationDecorator = ReturnType<typeof withBrandsByClassName> | ReturnType<typeof withBrandsByDataAttribute>;

interface RenderOptions {
  parameters?: unknown;
  storyGlobals?: Record<string, unknown>;
  userGlobals?: Record<string, unknown>;
}

const render = (decorator: ActivationDecorator, globalBrand: unknown, options: RenderOptions = {}): unknown =>
  decorator(
    (() => 'story result') as never,
    {
      canvasElement: document.body,
      globals: { [BRAND_GLOBAL]: globalBrand },
      parameters: { [BRANDS_PARAMETER]: options.parameters },
      storyGlobals: options.storyGlobals ?? {},
      userGlobals: options.userGlobals ?? (globalBrand === undefined ? {} : { [BRAND_GLOBAL]: globalBrand }),
      viewMode: 'story',
    } as unknown as StoryContext,
  );

const invalidConfig = (factory: (config: never) => ActivationDecorator, config: unknown, path: string): void => {
  expect(() => factory(config as never)).toThrowError(
    new RegExp(`^\\[storybook-brands-addon\\] ${path.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`),
  );
};

describe('simple activation helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    hook.cleanup?.();
    hook.cleanup = undefined;
    hook.emit.mockReset();
    hook.listeners = {};
    hook.useChannel.mockClear();
    hook.useEffect.mockReset();
    hook.useEffect.mockImplementation((create) => {
      hook.cleanup?.();
      hook.cleanup = create();
    });
    document.documentElement.removeAttribute('data-brand');
    document.documentElement.removeAttribute('data-tenant');
    document.documentElement.removeAttribute('class');
    document.documentElement.removeAttribute('style');
    document.body.innerHTML = '<main id="target" class="original"></main>';
  });

  it('uses data-brand, the brand ID, html, and the first brand by default', () => {
    const decorator = withBrandsByDataAttribute({
      brands: [
        { id: 'alpha', title: 'Alpha' },
        { id: 'beta', title: 'Beta' },
      ],
    });

    expect(render(decorator, undefined)).toBe('story result');
    expect(document.documentElement.getAttribute('data-brand')).toBe('alpha');
  });

  it('supports custom attribute names, values, targets, and defaults', () => {
    const decorator = withBrandsByDataAttribute({
      attributeName: 'data-tenant',
      defaultBrand: 'beta',
      target: '#target',
      brands: [
        { id: 'alpha', title: 'Alpha', value: '' },
        { id: 'beta', title: 'Beta', value: 'tenant-b' },
      ],
    });

    render(decorator, undefined);
    expect(document.querySelector('#target')?.getAttribute('data-tenant')).toBe('tenant-b');

    render(decorator, 'alpha');
    expect(document.querySelector('#target')?.getAttribute('data-tenant')).toBe('');
  });

  it('splits one or more class tokens using DOM ASCII whitespace', () => {
    const decorator = withBrandsByClassName({
      target: '#target',
      brands: [
        { id: 'alpha', title: 'Alpha', className: '  theme-alpha\tcompact\n' },
        { id: 'beta', title: 'Beta', className: 'theme-beta' },
      ],
    });

    render(decorator, undefined);
    expect([...document.querySelector('#target')!.classList]).toEqual(['original', 'theme-alpha', 'compact']);
  });

  it.each([
    {
      name: 'data attributes',
      create: () =>
        withBrandsByDataAttribute({
          target: '#target',
          brands: [
            { id: 'alpha', title: 'Alpha' },
            { id: 'beta', title: 'Beta' },
          ],
        }),
      applied: () => document.querySelector('#target')?.getAttribute('data-brand'),
    },
    {
      name: 'class names',
      create: () =>
        withBrandsByClassName({
          target: '#target',
          brands: [
            { id: 'alpha', title: 'Alpha', className: 'alpha' },
            { id: 'beta', title: 'Beta', className: 'beta' },
          ],
        }),
      applied: () => (document.querySelector('#target')?.classList.contains('beta') ? 'beta' : 'alpha'),
    },
  ])('reuses registration and story selection for $name', ({ create, applied }) => {
    const decorator = create();

    render(decorator, 'beta', {
      parameters: { allowed: ['alpha'] },
      userGlobals: { [BRAND_GLOBAL]: 'beta' },
    });

    expect(applied()).toBe('alpha');
    expect(hook.emit).toHaveBeenCalledWith(REGISTER_EVENT, {
      brands: [
        { id: 'alpha', title: 'Alpha' },
        { id: 'beta', title: 'Beta' },
      ],
      defaultBrand: undefined,
    });
  });

  it('snapshots convenience configuration and restores the exact target baseline', () => {
    const source: ClassNameBrandsConfig = {
      target: '#target',
      brands: [{ id: 'alpha', title: 'Alpha', className: 'alpha compact' }],
    };
    const decorator = withBrandsByClassName(source);
    source.target = 'html';
    source.brands[0]!.className = 'mutated';

    render(decorator, undefined);
    expect(document.querySelector('#target')?.className).toBe('original alpha compact');

    hook.cleanup?.();
    hook.cleanup = undefined;
    expect(document.querySelector('#target')?.outerHTML).toBe('<main id="target" class="original"></main>');
  });
});

describe('simple activation validation', () => {
  it('validates shared configuration fields synchronously', () => {
    const factory = withBrandsByDataAttribute as (config: never) => ActivationDecorator;

    invalidConfig(factory, null, 'config');
    invalidConfig(factory, {}, 'brands');
    invalidConfig(factory, { brands: [] }, 'brands');
    invalidConfig(factory, { brands: [null] }, 'brands[0]');
    invalidConfig(factory, { brands: [{ id: '', title: 'Alpha' }] }, 'brands[0].id');
    invalidConfig(
      factory,
      {
        brands: [
          { id: 'same', title: 'Alpha' },
          { id: 'same', title: 'Other' },
        ],
      },
      'brands[1].id',
    );
    invalidConfig(factory, { brands: [{ id: 'alpha', title: '' }] }, 'brands[0].title');
    invalidConfig(factory, { brands: [{ id: 'alpha', title: 'Alpha' }], defaultBrand: 'missing' }, 'defaultBrand');
    invalidConfig(factory, { brands: [{ id: 'alpha', title: 'Alpha' }], target: ' ' }, 'target');
  });

  it('validates data-attribute-specific fields with public paths', () => {
    const factory = withBrandsByDataAttribute as (config: never) => ActivationDecorator;
    const brand = { id: 'alpha', title: 'Alpha' };

    invalidConfig(factory, { brands: [brand], attributeName: 'invalid name' }, 'attributeName');
    invalidConfig(factory, { brands: [brand], attributeName: 'class' }, 'attributeName');
    invalidConfig(factory, { brands: [{ ...brand, value: 42 }] }, 'brands[0].value');
  });

  it('validates class-specific fields with public paths', () => {
    const factory = withBrandsByClassName as (config: never) => ActivationDecorator;
    const brand = { id: 'alpha', title: 'Alpha' };

    invalidConfig(factory, { brands: [brand] }, 'brands[0].className');
    invalidConfig(factory, { brands: [{ ...brand, className: 42 }] }, 'brands[0].className');
    invalidConfig(factory, { brands: [{ ...brand, className: ' \t\n ' }] }, 'brands[0].className');
  });

  it('snapshots data-attribute names and values synchronously', () => {
    const source: DataAttributeBrandsConfig = {
      attributeName: 'data-tenant',
      brands: [{ id: 'alpha', title: 'Alpha', value: 'tenant-a' }],
    };
    const decorator = withBrandsByDataAttribute(source);
    source.attributeName = 'data-mutated';
    source.brands[0]!.value = 'mutated';

    render(decorator, undefined);
    expect(document.documentElement.getAttribute('data-tenant')).toBe('tenant-a');
    expect(document.documentElement.hasAttribute('data-mutated')).toBe(false);
  });
});
