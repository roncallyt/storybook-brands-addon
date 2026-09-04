import React, { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const managerApi = vi.hoisted(() => ({
  add: vi.fn(),
  register: vi.fn((_id: string, register: () => void) => register()),
  useChannel: vi.fn(),
  useGlobals: vi.fn(),
  useParameter: vi.fn(),
}));

vi.mock('@storybook/icons', () => ({ PaintBrushIcon: 'paint-brush-icon' }));
vi.mock('storybook/internal/components', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');

  const IconButton = ReactModule.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
  >(({ active, children, ...props }, ref) =>
    ReactModule.createElement('button', { ...props, 'data-active': active ? 'true' : 'false', ref }, children),
  );

  interface Link {
    active?: boolean;
    id: string;
    title: React.ReactNode;
    [key: string]: unknown;
  }

  const TooltipLinkList = ({ links, ...props }: React.HTMLAttributes<HTMLDivElement> & { links: Link[] }) =>
    ReactModule.createElement(
      'div',
      props,
      links.map(({ active, id, title, ...linkProps }) =>
        ReactModule.createElement('button', { ...linkProps, 'data-active': active ? 'true' : 'false', key: id }, title),
      ),
    );

  interface WithTooltipProps {
    children: React.ReactNode;
    onVisibleChange?: (visible: boolean) => void;
    title?: string;
    tooltip: React.ReactNode | ((props: { onHide: () => void }) => React.ReactNode);
    trigger?: 'click' | 'hover';
  }

  const WithTooltip = ({ children, onVisibleChange, title, tooltip, trigger = 'click' }: WithTooltipProps) => {
    const [visible, setVisible] = ReactModule.useState(false);
    const changeVisibility = ReactModule.useCallback(
      (nextVisible: boolean) => {
        setVisible(nextVisible);
        onVisibleChange?.(nextVisible);
      },
      [onVisibleChange],
    );

    ReactModule.useEffect(() => {
      if (!visible) {
        return undefined;
      }

      const closeOnEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          changeVisibility(false);
        }
      };
      document.addEventListener('keydown', closeOnEscape);
      return () => document.removeEventListener('keydown', closeOnEscape);
    }, [changeVisibility, visible]);

    return ReactModule.createElement(
      'div',
      {
        'data-testid': 'with-tooltip',
        onClick:
          trigger === 'click'
            ? (event: React.MouseEvent<HTMLDivElement>) => {
                if ((event.target as Element).closest('[aria-haspopup="menu"]') !== null) {
                  changeVisibility(!visible);
                }
              }
            : undefined,
        onMouseEnter: trigger === 'hover' ? () => changeVisibility(true) : undefined,
        onMouseLeave: trigger === 'hover' ? () => changeVisibility(false) : undefined,
        title,
      },
      children,
      visible
        ? ReactModule.createElement(
            'div',
            { 'data-testid': 'tooltip' },
            typeof tooltip === 'function' ? tooltip({ onHide: () => changeVisibility(false) }) : tooltip,
          )
        : null,
    );
  };

  return { IconButton, TooltipLinkList, WithTooltip };
});
vi.mock('storybook/manager-api', () => ({
  addons: { add: managerApi.add, register: managerApi.register },
  types: { TOOL: 'tool' },
  useChannel: managerApi.useChannel,
  useGlobals: managerApi.useGlobals,
  useParameter: managerApi.useParameter,
}));

import { BRAND_GLOBAL, TOOL_ID } from './constants';
import { BrandSelect, BrandSelectorPresentation } from './manager';
import type { BrandsRegistration } from './protocol';

interface SelectProps {
  ariaDescription: string;
  ariaLabel: string;
  children: unknown;
  disabled?: boolean;
  onSelect?: (value: unknown) => void;
  options: { value: string; title: string }[];
  selectedId?: string;
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
    expect(props.tooltip).toContain('withBrandsByDataAttribute()');
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
    props.onSelect?.('first.brand');
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
    expect(props.selectedId).toBe('first.brand');
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
    expect(props.selectedId).toBeUndefined();
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
    expect(props.selectedId).toBe('four');
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

describe('BrandSelect', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderSelect = (options = registration.brands, overrides: Partial<SelectProps> = {}) => {
    const onSelect = vi.fn();
    act(() => {
      root.render(
        <BrandSelect
          ariaDescription="Change brand"
          ariaLabel="Brand"
          onSelect={onSelect}
          options={options.map(({ id, title }) => ({ title, value: id }))}
          selectedId={options[0]?.id}
          tooltip="Change brand"
          {...overrides}
        >
          {options[0]?.title ?? 'Brand'}
        </BrandSelect>,
      );
    });
    return onSelect;
  };

  it.each([1, 2, 4])('opens the same menu for a %i-brand catalog', (size) => {
    renderSelect(registration.brands.slice(0, size));
    const trigger = container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    act(() => trigger.click());

    const menu = container.querySelector<HTMLElement>('[role="menu"]')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(menu.querySelectorAll('button')).toHaveLength(size);
    expect(menu.querySelector('[aria-pressed="true"]')).toBe(document.activeElement);
  });

  it('supports keyboard navigation, selection, closing, and focus restoration', () => {
    const onSelect = renderSelect();
    const trigger = container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
    act(() => trigger.click());

    const menu = container.querySelector<HTMLElement>('[role="menu"]')!;
    const items = [...menu.querySelectorAll<HTMLButtonElement>('button')];
    expect(items[0]).toBe(document.activeElement);

    act(() => items[0]?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' })));
    expect(items[3]).toBe(document.activeElement);
    act(() => items[3]?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Home' })));
    expect(items[0]).toBe(document.activeElement);
    act(() => items[0]?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'End' })));
    expect(items[3]).toBe(document.activeElement);
    act(() => items[3]?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' })));
    expect(items[0]).toBe(document.activeElement);

    act(() => items[1]?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' })));
    expect(onSelect).toHaveBeenCalledWith('project / default');
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(trigger).toBe(document.activeElement);

    act(() => trigger.click());
    const activeItem = container.querySelector<HTMLButtonElement>('[role="menu"] button')!;
    act(() => activeItem.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });

  it('renders an inert disabled button with an explanatory tooltip', () => {
    renderSelect(registration.brands.slice(0, 2), {
      ariaDescription: 'Brand switching is disabled for this story.',
      ariaLabel: 'Brand switching disabled',
      disabled: true,
      onSelect: undefined,
      selectedId: undefined,
      tooltip: 'Brand switching is disabled for this story.',
    });

    const trigger = container.querySelector<HTMLButtonElement>('button')!;
    const wrapper = container.querySelector<HTMLElement>('[data-testid="with-tooltip"]')!;
    expect(trigger.disabled).toBe(true);
    expect(trigger.getAttribute('aria-haspopup')).toBeNull();
    expect(container.querySelector('[role="menu"]')).toBeNull();

    act(() => wrapper.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    expect(container.querySelector('[data-testid="tooltip"]')?.textContent).toContain(
      'Brand switching is disabled for this story.',
    );
  });
});
