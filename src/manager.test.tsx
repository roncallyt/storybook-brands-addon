import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const managerApi = vi.hoisted(() => ({
  add: vi.fn(),
  register: vi.fn((_id: string, register: () => void) => register()),
  useChannel: vi.fn(),
  useGlobals: vi.fn(),
}));

vi.mock('@storybook/icons', () => ({ PaintBrushIcon: 'paint-brush-icon' }));
vi.mock('storybook/internal/components', () => ({ Select: 'storybook-select' }));
vi.mock('storybook/manager-api', () => ({
  addons: { add: managerApi.add, register: managerApi.register },
  types: { TOOL: 'tool' },
  useChannel: managerApi.useChannel,
  useGlobals: managerApi.useGlobals,
}));

import { BRAND_GLOBAL, TOOL_ID } from './constants';
import { BrandSelectorPresentation, resolveRegisteredBrand } from './manager';
import type { BrandsRegistration } from './protocol';

interface SelectProps {
  ariaLabel: string;
  children: unknown;
  defaultOptions?: string;
  disabled?: boolean;
  onSelect?: (value: unknown) => void;
  options: { value: string; title: string }[];
  tooltip: string;
}

const registration: BrandsRegistration = {
  brands: [
    { id: 'first.brand', title: 'First Brand' },
    { id: 'project / default', title: 'Project Default' },
    { id: '品牌-三', title: 'Selected Brand' },
    { id: 'four', title: 'Fourth Brand' },
  ],
  defaultBrand: 'project / default',
};

const renderPresentation = (
  globals: Record<string, unknown> = {},
  storyGlobals: Record<string, unknown> = {},
  updateGlobals = vi.fn(),
  catalog: BrandsRegistration | null = registration,
): SelectProps =>
  (
    BrandSelectorPresentation({
      globals,
      registration: catalog ?? undefined,
      storyGlobals,
      updateGlobals,
    }) as ReactElement<SelectProps>
  ).props;

describe('brand selector manager registration', () => {
  it('registers a Canvas-only toolbar tool', () => {
    expect(managerApi.register).toHaveBeenCalledOnce();
    expect(managerApi.add).toHaveBeenCalledOnce();

    const [id, tool] = managerApi.add.mock.calls[0] as unknown as [
      string,
      { type: string; match: (context: { viewMode: string }) => boolean },
    ];
    expect(id).toBe(TOOL_ID);
    expect(tool.type).toBe('tool');
    expect(tool.match({ viewMode: 'story' })).toBe(true);
    expect(tool.match({ viewMode: 'docs' })).toBe(false);
  });
});

describe('BrandSelectorPresentation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows an actionable disabled selector before preview configuration arrives', () => {
    const props = renderPresentation({}, {}, vi.fn(), null);

    expect(props.disabled).toBe(true);
    expect(props.options).toEqual([]);
    expect(props.tooltip).toContain('withBrands()');
    expect(props.tooltip).toContain('.storybook/preview.ts');
  });

  it('preserves catalog order and exact IDs and titles', () => {
    const props = renderPresentation();

    expect(props.options).toEqual([
      { value: 'first.brand', title: 'First Brand' },
      { value: 'project / default', title: 'Project Default' },
      { value: '品牌-三', title: 'Selected Brand' },
      { value: 'four', title: 'Fourth Brand' },
    ]);
  });

  it('resolves the displayed title from the merged global, project default, then first brand', () => {
    expect(renderPresentation({ [BRAND_GLOBAL]: '品牌-三' }).children).toBe('Selected Brand');
    expect(renderPresentation().children).toBe('Project Default');

    const withoutDefault = { ...registration, defaultBrand: undefined };
    expect(renderPresentation({}, {}, vi.fn(), withoutDefault).children).toBe('First Brand');
  });

  it('updates the persistent global only after an explicit valid selection', () => {
    const updateGlobals = vi.fn();
    const props = renderPresentation({}, {}, updateGlobals);

    props.onSelect?.('four');
    expect(updateGlobals).toHaveBeenCalledWith({ [BRAND_GLOBAL]: 'four' });

    updateGlobals.mockClear();
    props.onSelect?.('missing');
    props.onSelect?.(42);
    expect(updateGlobals).not.toHaveBeenCalled();
  });

  it('falls back for an unknown merged global without mutating it', () => {
    const updateGlobals = vi.fn();
    const props = renderPresentation({ [BRAND_GLOBAL]: 'saved-but-missing' }, {}, updateGlobals);

    expect(props.children).toBe('Project Default');
    expect(props.defaultOptions).toBe('project / default');
    expect(updateGlobals).not.toHaveBeenCalled();
  });

  it('displays and locks the effective story-global brand without overwriting the saved global', () => {
    const updateGlobals = vi.fn();
    const props = renderPresentation({ [BRAND_GLOBAL]: '品牌-三' }, { [BRAND_GLOBAL]: '品牌-三' }, updateGlobals);

    expect(props.children).toBe('Selected Brand');
    expect(props.disabled).toBe(true);
    expect(props.tooltip).toContain('set by this story');
    props.onSelect?.('four');
    expect(updateGlobals).not.toHaveBeenCalled();
  });

  it('uses brand-key membership to identify a hard story override', () => {
    expect(renderPresentation({}, { [BRAND_GLOBAL]: undefined }).disabled).toBe(true);
    expect(renderPresentation({}, {}).disabled).toBe(false);
  });
});

describe('resolveRegisteredBrand', () => {
  it('does not alter the registration while resolving an unknown global', () => {
    const before = JSON.stringify(registration);
    expect(resolveRegisteredBrand(registration, 'unknown').id).toBe('project / default');
    expect(JSON.stringify(registration)).toBe(before);
  });
});
