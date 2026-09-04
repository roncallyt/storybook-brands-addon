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

import { REGISTER_EVENT, REQUEST_EVENT } from './constants';
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

const render = (decorator: ReturnType<typeof withBrands>, viewMode: 'story' | 'docs', globalBrand: unknown): unknown =>
  decorator(
    (() => 'story result') as never,
    {
      canvasElement: document.body,
      globals: { brand: globalBrand },
      viewMode,
    } as unknown as StoryContext,
  );

describe('withBrands', () => {
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
    document.body.innerHTML = '<main id="target" class="original"></main>';
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
      { canvasElement: document.body, globals, viewMode: 'story' } as unknown as StoryContext,
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

  it('leaves Docs untouched even when the target is invalid', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const source = config();
    source.target = '[';

    expect(() => render(withBrands(source), 'docs', 'alpha')).not.toThrow();
    expect(warning).not.toHaveBeenCalled();
  });
});
