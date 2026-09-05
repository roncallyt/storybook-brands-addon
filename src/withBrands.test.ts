import { beforeEach, describe, expect, it, vi } from 'vitest';

const hook = vi.hoisted(() => ({
  cleanup: undefined as (() => void) | undefined,
  docsContext: undefined as import('./protocol').DocsBrandContext | undefined,
  emit: vi.fn(),
  listeners: {} as Record<string, (...args: unknown[]) => void>,
  useEffect: vi.fn<(create: () => (() => void) | undefined) => void>(),
  useChannel: vi.fn((listeners: Record<string, (...args: unknown[]) => void>) => {
    hook.listeners = listeners;
    return hook.emit;
  }),
  useState: vi.fn(() => [
    hook.docsContext,
    (
      value:
        | import('./protocol').DocsBrandContext
        | ((
            current: import('./protocol').DocsBrandContext | undefined,
          ) => import('./protocol').DocsBrandContext | undefined),
    ) => (hook.docsContext = typeof value === 'function' ? value(hook.docsContext) : value),
  ]),
}));

vi.mock('storybook/preview-api', () => ({
  useChannel: hook.useChannel,
  useEffect: hook.useEffect,
  useState: hook.useState,
}));

import type { StoryContext } from 'storybook/internal/types';

import {
  BRAND_GLOBAL,
  BRANDS_PARAMETER,
  DOCS_CONTEXT_EVENT,
  DOCS_CONTEXT_REQUEST_EVENT,
  DOCS_PARAMETERS_EVENT,
  REGISTER_EVENT,
  REQUEST_EVENT,
} from './constants';
import type { BrandsConfig } from './types';
import { withBrands } from './withBrands';

const config = (): BrandsConfig => ({
  defaultBrand: 'alpha',
  target: '#target',
  brands: [
    {
      id: 'alpha',
      title: 'Alpha',
      attributes: { 'data-brand': 'alpha' },
      classes: ['alpha'],
      cssVariables: { '--brand-color': 'red' },
    },
    {
      id: 'beta',
      title: 'Beta',
      attributes: { 'data-brand': 'beta' },
      classes: ['beta'],
      cssVariables: { '--brand-color': 'blue' },
    },
  ],
});

interface RenderOptions {
  parameters?: unknown;
  storyGlobals?: Record<string, unknown>;
  userGlobals?: Record<string, unknown>;
}

const render = (
  decorator: ReturnType<typeof withBrands>,
  viewMode: 'story' | 'docs',
  globalBrand: unknown,
  options: RenderOptions = {},
): unknown =>
  decorator(
    (() => 'story result') as never,
    {
      canvasElement: document.body,
      componentId: 'brands-showcase',
      globals: { brand: globalBrand },
      parameters: { [BRANDS_PARAMETER]: options.parameters },
      storyGlobals: options.storyGlobals ?? {},
      userGlobals: options.userGlobals ?? (globalBrand === undefined ? {} : { [BRAND_GLOBAL]: globalBrand }),
      viewMode,
    } as unknown as StoryContext,
  );

describe('withBrands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    hook.cleanup?.();
    hook.cleanup = undefined;
    hook.docsContext = undefined;
    hook.emit.mockReset();
    hook.listeners = {};
    hook.useChannel.mockClear();
    hook.useEffect.mockReset();
    hook.useEffect.mockImplementation((create) => {
      hook.cleanup?.();
      hook.cleanup = create();
    });
    document.body.innerHTML = '<main id="target" class="original"></main>';
    window.history.replaceState({}, '', '/');
  });

  it('returns the story result and applies the selected global in Canvas', () => {
    const result = render(withBrands(config()), 'story', 'beta');
    const target = document.querySelector('#target') as HTMLElement;

    expect(result).toBe('story result');
    expect(target.getAttribute('data-brand')).toBe('beta');
    expect(target.className).toBe('original beta');
  });

  it('does not overwrite unknown globals and falls back non-fatally', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const globals = { brand: 'saved-but-missing' };
    const decorator = withBrands(config());
    decorator(
      (() => 'story result') as never,
      {
        canvasElement: document.body,
        globals,
        parameters: {},
        storyGlobals: {},
        userGlobals: globals,
        viewMode: 'story',
      } as unknown as StoryContext,
    );

    expect(globals.brand).toBe('saved-but-missing');
    expect(document.querySelector('#target')?.getAttribute('data-brand')).toBe('alpha');
    expect(warning).toHaveBeenCalledOnce();
  });

  it('cleans up on brand changes, Docs transitions, and unmount', () => {
    const decorator = withBrands(config());
    const target = document.querySelector('#target') as HTMLElement;

    render(decorator, 'story', 'alpha');
    expect(target.className).toBe('original alpha');

    render(decorator, 'story', 'beta');
    expect(target.className).toBe('original beta');
    expect(target.style.getPropertyValue('--brand-color')).toBe('blue');

    render(decorator, 'docs', 'beta');
    expect(target.outerHTML).toBe('<main id="target" class="original"></main>');

    render(decorator, 'story', 'alpha');
    hook.cleanup?.();
    hook.cleanup = undefined;
    expect(target.outerHTML).toBe('<main id="target" class="original"></main>');
  });

  it('uses the configuration snapshot after caller mutation', () => {
    const source = config();
    const decorator = withBrands(source);
    source.brands[0]!.attributes!['data-brand'] = 'mutated';
    source.brands[0]!.classes![0] = 'mutated';
    source.defaultBrand = 'beta';

    render(decorator, 'story', undefined);

    const target = document.querySelector('#target') as HTMLElement;
    expect(target.getAttribute('data-brand')).toBe('alpha');
    expect(target.classList.contains('alpha')).toBe(true);
    expect(target.classList.contains('mutated')).toBe(false);
  });

  it('proactively registers an ordered metadata-only catalog of arbitrary size', () => {
    const source: BrandsConfig = {
      defaultBrand: 'brand / two',
      target: '#target',
      brands: [
        { id: 'brand.one', title: 'Brand One', attributes: { 'data-private': 'one' } },
        { id: 'brand / two', title: 'Brand Two', classes: ['private'] },
        { id: '品牌-三', title: 'Brand Three', cssVariables: { '--private': 'three' } },
        { id: 'FOUR', title: 'Brand Four' },
      ],
    };
    const decorator = withBrands(source);

    source.brands[0]!.id = 'mutated';
    source.brands[1]!.title = 'Mutated';
    source.defaultBrand = 'FOUR';
    render(decorator, 'story', undefined);

    expect(hook.emit).toHaveBeenCalledWith(REGISTER_EVENT, {
      brands: [
        { id: 'brand.one', title: 'Brand One' },
        { id: 'brand / two', title: 'Brand Two' },
        { id: '品牌-三', title: 'Brand Three' },
        { id: 'FOUR', title: 'Brand Four' },
      ],
      defaultBrand: 'brand / two',
    });
  });

  it('resends the snapshotted catalog when the manager requests it', () => {
    const source = config();
    const decorator = withBrands(source);
    render(decorator, 'story', 'alpha');
    hook.emit.mockClear();
    source.brands[0]!.title = 'Mutated';

    hook.listeners[REQUEST_EVENT]?.();

    expect(hook.emit).toHaveBeenCalledOnce();
    expect(hook.emit).toHaveBeenCalledWith(REGISTER_EVENT, {
      brands: [
        { id: 'alpha', title: 'Alpha' },
        { id: 'beta', title: 'Beta' },
      ],
      defaultBrand: 'alpha',
    });
  });

  it('temporarily applies an allowed fallback without changing the saved user global', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const userGlobals = { [BRAND_GLOBAL]: 'beta' };

    render(withBrands(config()), 'story', 'beta', {
      parameters: { allowed: ['alpha'] },
      userGlobals,
    });

    expect(document.querySelector('#target')?.getAttribute('data-brand')).toBe('alpha');
    expect(userGlobals[BRAND_GLOBAL]).toBe('beta');
    expect(warning).not.toHaveBeenCalled();
  });

  it('uses a story default as a non-locking fallback after the user selection', () => {
    const decorator = withBrands(config());

    render(decorator, 'story', undefined, { parameters: { default: 'beta' } });
    expect(document.querySelector('#target')?.getAttribute('data-brand')).toBe('beta');

    render(decorator, 'story', 'alpha', {
      parameters: { default: 'beta' },
      userGlobals: { [BRAND_GLOBAL]: 'alpha' },
    });
    expect(document.querySelector('#target')?.getAttribute('data-brand')).toBe('alpha');
  });

  it('applies and warns about a forced story brand outside the allowed set', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(withBrands(config()), 'story', 'beta', {
      parameters: { allowed: ['alpha'] },
      storyGlobals: { [BRAND_GLOBAL]: 'beta' },
      userGlobals: { [BRAND_GLOBAL]: 'alpha' },
    });

    expect(document.querySelector('#target')?.getAttribute('data-brand')).toBe('beta');
    expect(warning).toHaveBeenCalledOnce();
    expect(warning.mock.calls[0]?.[0]).toMatch(/^\[storybook-brands-addon\] storyGlobals\.brand:/);
  });

  it('restores addon-owned DOM changes when the story disables brands', () => {
    const decorator = withBrands(config());
    const target = document.querySelector('#target') as HTMLElement;

    render(decorator, 'story', 'alpha');
    expect(target.className).toBe('original alpha');

    render(decorator, 'story', 'alpha', { parameters: { disabled: true } });
    expect(target.outerHTML).toBe('<main id="target" class="original"></main>');
  });

  it('warns non-fatally about invalid story metadata', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() =>
      render(withBrands(config()), 'story', undefined, {
        parameters: { allowed: ['missing'], default: 'missing', disabled: 'yes' },
      }),
    ).not.toThrow();

    expect(document.querySelector('#target')?.getAttribute('data-brand')).toBe('alpha');
    expect(warning).toHaveBeenCalledTimes(4);
    expect(warning.mock.calls.every(([message]) => /^\[storybook-brands-addon\]/.test(message as string))).toBe(true);
  });

  it('leaves Docs untouched even when the target is invalid', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const source = config();
    source.target = '[';

    expect(() =>
      render(withBrands(source), 'docs', 'alpha', {
        parameters: { allowed: ['missing'], default: 'missing' },
      }),
    ).not.toThrow();
    expect(warning).not.toHaveBeenCalled();
  });

  it('applies only a current, supported manager-owned Docs context', () => {
    const decorator = withBrands(config());
    const storyParameters = { disabled: true, docs: { allowed: ['alpha'] } };
    window.history.replaceState({}, '', '/iframe.html?id=brands-showcase--docs&viewMode=docs');

    render(decorator, 'docs', 'alpha', {
      parameters: storyParameters,
      storyGlobals: { [BRAND_GLOBAL]: 'alpha' },
    });
    expect(hook.emit).toHaveBeenCalledWith(DOCS_CONTEXT_REQUEST_EVENT);
    expect(document.querySelector('#target')?.getAttribute('data-brand')).toBeNull();

    const docsContext = {
      pageId: 'brands-showcase--docs',
      ownerComponentId: 'brands-showcase',
      supported: true,
      disabled: false,
      brandId: 'beta',
    } satisfies import('./protocol').DocsBrandContext;
    hook.listeners[DOCS_CONTEXT_EVENT]?.(docsContext);
    hook.listeners[DOCS_CONTEXT_EVENT]?.({ ...docsContext });
    expect(hook.docsContext).toBe(docsContext);

    render(decorator, 'docs', 'alpha', {
      parameters: storyParameters,
      storyGlobals: { [BRAND_GLOBAL]: 'alpha' },
    });
    expect(hook.emit).toHaveBeenCalledWith(DOCS_PARAMETERS_EVENT, {
      pageId: 'brands-showcase--docs',
      componentId: 'brands-showcase',
      parameters: storyParameters,
    });
    expect(document.querySelector('#target')?.getAttribute('data-brand')).toBe('beta');

    hook.listeners[DOCS_CONTEXT_EVENT]?.({
      pageId: 'another-page--docs',
      ownerComponentId: 'brands-showcase',
      supported: true,
      disabled: false,
      brandId: 'alpha',
    });
    render(decorator, 'docs', 'alpha');
    expect(document.querySelector('#target')?.getAttribute('data-brand')).toBeNull();

    hook.listeners[DOCS_CONTEXT_EVENT]?.({
      pageId: 'brands-showcase--docs',
      ownerComponentId: undefined,
      supported: false,
      disabled: false,
      brandId: undefined,
    });
    render(decorator, 'docs', 'alpha');
    expect(document.querySelector('#target')?.outerHTML).toBe('<main id="target" class="original"></main>');
  });
});
