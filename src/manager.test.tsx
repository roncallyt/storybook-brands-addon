import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const managerApi = vi.hoisted(() => ({
  add: vi.fn(),
  register: vi.fn((_id: string, register: () => void) => register()),
  useChannel: vi.fn(),
  useGlobals: vi.fn(),
  useParameter: vi.fn(),
}));

vi.mock('@storybook/icons', () => ({ PaintBrushIcon: 'paint-brush-icon' }));
vi.mock('storybook/internal/components', () => ({ Select: 'storybook-select' }));
vi.mock('storybook/manager-api', () => ({
  addons: { add: managerApi.add, register: managerApi.register },
  types: { TOOL: 'tool' },
  useChannel: managerApi.useChannel,
  useGlobals: managerApi.useGlobals,
  useParameter: managerApi.useParameter,
}));

import { BRAND_GLOBAL, TOOL_ID } from './constants';
import { BrandSelectorPresentation } from './manager';
import type { BrandsRegistration } from './protocol';

interface SelectProps {
  ariaDescription: string;
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

interface RenderOptions {
  catalog?: BrandsRegistration | null;
  parameters?: unknown;
  storyGlobals?: Record<string, unknown>;
  updateGlobals?: (globals: Record<string, unknown>) => void;
  userGlobals?: Record<string, unknown>;
}

const renderPresentation = ({
  catalog = registration,
  parameters,
  storyGlobals = {},
  updateGlobals = vi.fn(),
  userGlobals = {},
}: RenderOptions = {}): SelectProps =>
  (
    BrandSelectorPresentation({
      parameters,
      registration: catalog ?? undefined,
      storyGlobals,
      updateGlobals,
      userGlobals,
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
    const props = renderPresentation({ catalog: null });

    expect(props.disabled).toBe(true);
    expect(props.options).toEqual([]);
    expect(props.tooltip).toContain('withBrands()');
    expect(props.ariaDescription).toBe(props.tooltip);
  });

  it('preserves catalog order and exact IDs and titles', () => {
    expect(renderPresentation().options).toEqual([
      { value: 'first.brand', title: 'First Brand' },
      { value: 'project / default', title: 'Project Default' },
      { value: '品牌-三', title: 'Selected Brand' },
      { value: 'four', title: 'Fourth Brand' },
    ]);
  });

  it('resolves user, story-default, project-default, and first-brand titles', () => {
    expect(renderPresentation({ userGlobals: { [BRAND_GLOBAL]: '品牌-三' } }).children).toBe('Selected Brand');
    expect(renderPresentation({ parameters: { default: 'first.brand' } }).children).toBe('First Brand');
    expect(renderPresentation().children).toBe('Project Default');
    expect(renderPresentation({ catalog: { ...registration, defaultBrand: undefined } }).children).toBe('First Brand');
  });

  it('restricts options and updates only after an explicit currently allowed selection', () => {
    const updateGlobals = vi.fn();
    const props = renderPresentation({
      parameters: { allowed: ['four', 'first.brand'] },
      updateGlobals,
    });

    expect(props.options.map(({ value }) => value)).toEqual(['first.brand', 'four']);
    props.onSelect?.('four');
    expect(updateGlobals).toHaveBeenCalledWith({ [BRAND_GLOBAL]: 'four' });

    updateGlobals.mockClear();
    props.onSelect?.('品牌-三');
    props.onSelect?.('missing');
    props.onSelect?.(42);
    expect(updateGlobals).not.toHaveBeenCalled();
  });

  it('shows a temporary fallback for a disallowed saved selection without mutating it', () => {
    const updateGlobals = vi.fn();
    const userGlobals = { [BRAND_GLOBAL]: '品牌-三' };
    const props = renderPresentation({
      parameters: { allowed: ['first.brand', 'four'] },
      updateGlobals,
      userGlobals,
    });

    expect(props.children).toBe('First Brand');
    expect(props.defaultOptions).toBe('first.brand');
    expect(props.disabled).toBe(false);
    expect(props.tooltip).toContain('Saved brand');
    expect(props.tooltip).toContain('Selected Brand');
    expect(props.ariaDescription).toBe(props.tooltip);
    expect(userGlobals[BRAND_GLOBAL]).toBe('品牌-三');
    expect(updateGlobals).not.toHaveBeenCalled();
  });

  it('shows an inert disabled state and never updates globals', () => {
    const updateGlobals = vi.fn();
    const props = renderPresentation({ parameters: { disabled: true }, updateGlobals });

    expect(props.children).toBe('Brands disabled');
    expect(props.disabled).toBe(true);
    expect(props.defaultOptions).toBeUndefined();
    expect(props.tooltip).toContain('disabled for this story');
    expect(props.onSelect).toBeUndefined();
    expect(updateGlobals).not.toHaveBeenCalled();
  });

  it('displays and locks a valid story-global brand', () => {
    const updateGlobals = vi.fn();
    const props = renderPresentation({
      storyGlobals: { [BRAND_GLOBAL]: '品牌-三' },
      updateGlobals,
      userGlobals: { [BRAND_GLOBAL]: 'four' },
    });

    expect(props.children).toBe('Selected Brand');
    expect(props.disabled).toBe(true);
    expect(props.tooltip).toContain('set by this story');
    props.onSelect?.('four');
    expect(updateGlobals).not.toHaveBeenCalled();
  });

  it('shows a forced story brand even when it is outside the allowed options', () => {
    const props = renderPresentation({
      parameters: { allowed: ['first.brand'] },
      storyGlobals: { [BRAND_GLOBAL]: 'four' },
    });

    expect(props.children).toBe('Fourth Brand');
    expect(props.defaultOptions).toBe('four');
    expect(props.options).toEqual([{ value: 'first.brand', title: 'First Brand' }]);
    expect(props.disabled).toBe(true);
  });

  it('uses brand-key membership to lock an invalid story override on its fallback', () => {
    const props = renderPresentation({ storyGlobals: { [BRAND_GLOBAL]: undefined } });

    expect(props.children).toBe('Project Default');
    expect(props.disabled).toBe(true);
    expect(props.tooltip).toContain('unavailable');
    expect(renderPresentation().disabled).toBe(false);
  });
});
