import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeBrandsConfig } from './config';
import { applyBrand } from './dom';

const makeConfig = (target = '#target') =>
  normalizeBrandsConfig({
    target,
    brands: [
      {
        id: 'alpha',
        title: 'Alpha',
        attributes: { 'data-brand': 'alpha', lang: 'en' },
        classes: ['brand-alpha', 'light'],
        cssVariables: { '--brand-color': 'red', '--brand-radius': '4px' },
      },
      {
        id: 'beta',
        title: 'Beta',
        attributes: { 'data-brand': 'beta', dir: 'rtl' },
        classes: ['brand-beta'],
        cssVariables: { '--brand-color': 'blue' },
      },
    ],
  });

describe('brand DOM state', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('class');
    document.documentElement.removeAttribute('style');
    document.body.innerHTML = '<main id="target"></main>';
    vi.restoreAllMocks();
  });

  it('applies attributes, class tokens, and CSS variables', () => {
    const target = document.querySelector('#target') as HTMLElement;
    const config = makeConfig();

    applyBrand(target, config, config.brands[0]!);

    expect(target.getAttribute('data-brand')).toBe('alpha');
    expect(target.getAttribute('lang')).toBe('en');
    expect([...target.classList]).toEqual(['brand-alpha', 'light']);
    expect(target.style.getPropertyValue('--brand-color')).toBe('red');
    expect(target.style.getPropertyValue('--brand-radius')).toBe('4px');
  });

  it('restores the baseline before applying a different brand', () => {
    const target = document.querySelector('#target') as HTMLElement;
    const config = makeConfig();

    const cleanupAlpha = applyBrand(target, config, config.brands[0]!);
    const cleanupBeta = applyBrand(target, config, config.brands[1]!);

    expect(target.getAttribute('data-brand')).toBe('beta');
    expect(target.hasAttribute('lang')).toBe(false);
    expect(target.getAttribute('dir')).toBe('rtl');
    expect([...target.classList]).toEqual(['brand-beta']);
    expect(target.style.getPropertyValue('--brand-color')).toBe('blue');
    expect(target.style.getPropertyValue('--brand-radius')).toBe('');

    cleanupAlpha?.();
    expect(target.getAttribute('data-brand')).toBe('beta');

    cleanupBeta?.();
    expect(target.outerHTML).toBe('<main id="target"></main>');
  });

  it('restores exact original attribute, class, and style states', () => {
    const target = document.querySelector('#target') as HTMLElement;
    target.setAttribute('data-brand', 'original');
    target.setAttribute('lang', 'pt-BR');
    target.setAttribute('data-unrelated', 'keep');
    target.setAttribute('class', ' existing   classes ');
    target.setAttribute('style', 'color: green; --brand-color: purple !important; --unrelated: 10px;');
    const originalClass = target.getAttribute('class');
    const originalStyle = target.getAttribute('style');
    const config = makeConfig();

    const cleanup = applyBrand(target, config, config.brands[0]!);
    expect(target.style.getPropertyPriority('--brand-color')).toBe('');
    expect(target.getAttribute('data-unrelated')).toBe('keep');

    cleanup?.();

    expect(target.getAttribute('data-brand')).toBe('original');
    expect(target.getAttribute('lang')).toBe('pt-BR');
    expect(target.hasAttribute('dir')).toBe(false);
    expect(target.getAttribute('class')).toBe(originalClass);
    expect(target.getAttribute('style')).toBe(originalStyle);
    // jsdom does not expose priorities for custom properties through CSSOM, so
    // the exact restored declaration text is the observable priority check.
    expect(target.getAttribute('style')).toContain('--brand-color: purple !important');
    expect(target.getAttribute('data-unrelated')).toBe('keep');
  });

  it('restores absent class and style attributes rather than leaving empty ones', () => {
    const target = document.querySelector('#target') as HTMLElement;
    const config = makeConfig();

    const cleanup = applyBrand(target, config, config.brands[0]!);
    cleanup?.();

    expect(target.hasAttribute('class')).toBe(false);
    expect(target.hasAttribute('style')).toBe(false);
  });

  it('selects the target from the canvas element owner document', () => {
    const otherDocument = document.implementation.createHTMLDocument('preview');
    otherDocument.body.innerHTML = '<main id="target"></main><div id="canvas"></div>';
    const canvas = otherDocument.querySelector('#canvas')!;
    const target = otherDocument.querySelector('#target')!;
    const config = makeConfig();

    applyBrand(canvas, config, config.brands[0]!);

    expect(target.getAttribute('data-brand')).toBe('alpha');
    expect(document.querySelector('#target')?.hasAttribute('data-brand')).toBe(false);
  });

  it('defaults the target selector to the document element', () => {
    const config = normalizeBrandsConfig({
      brands: [
        {
          id: 'alpha',
          title: 'Alpha',
          attributes: { 'data-brand': 'alpha' },
        },
      ],
    });

    const cleanup = applyBrand(document.body, config, config.brands[0]!);

    expect(document.documentElement.getAttribute('data-brand')).toBe('alpha');
    cleanup?.();
    expect(document.documentElement.hasAttribute('data-brand')).toBe(false);
  });

  it.each([
    ['invalid selector', '['],
    ['missing target', '#missing'],
  ])('warns without throwing or mutating for an %s', (_label, selector) => {
    const target = document.querySelector('#target') as HTMLElement;
    const before = target.outerHTML;
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const config = makeConfig(selector);

    expect(() => applyBrand(target, config, config.brands[0]!)).not.toThrow();
    expect(target.outerHTML).toBe(before);
    expect(warning).toHaveBeenCalledWith(expect.stringMatching(/^\[storybook-brands-addon\] target:/));
  });

  it('warns when the target does not support inline styles', () => {
    const unsuitable = document.createElementNS('urn:example', 'brand-target');
    document.body.append(unsuitable);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const config = makeConfig('brand-target');

    expect(() => applyBrand(document.body, config, config.brands[0]!)).not.toThrow();
    expect(unsuitable.attributes).toHaveLength(0);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('does not match a suitable element'));
  });
});
