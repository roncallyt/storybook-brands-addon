import React, { useEffect, useRef, useState } from 'react';
import { PaintBrushIcon } from '@storybook/icons';
import { IconButton, TooltipLinkList, WithTooltip } from 'storybook/internal/components';
import { addons, types, useChannel, useGlobals, useParameter } from 'storybook/manager-api';

import { ADDON_ID, BRAND_GLOBAL, BRANDS_PARAMETER, REGISTER_EVENT, REQUEST_EVENT, TOOL_ID } from './constants';
import type { BrandsRegistration } from './protocol';
import { resolveStoryBrandState } from './storyState';

const MISSING_CONFIGURATION_TOOLTIP =
  'Configure brands with withBrandsByDataAttribute() or another brand decorator in .storybook/preview.ts to enable brand selection.';
const STORY_OVERRIDE_TOOLTIP = 'Brand selection is set by this story and cannot be changed.';
const DISABLED_TOOLTIP = 'Brand switching is disabled for this story.';
const ignoreWarning = (): void => undefined;

interface BrandSelectorPresentationProps {
  registration: BrandsRegistration | undefined;
  parameters: unknown;
  storyGlobals: Record<string, unknown>;
  userGlobals: Record<string, unknown>;
  updateGlobals: (globals: Record<string, unknown>) => void;
}

interface BrandSelectProps {
  ariaDescription: string;
  ariaLabel: string;
  children: string;
  disabled?: boolean;
  onSelect?: (value: string) => void;
  options: { value: string; title: string }[];
  selectedId?: string;
  tooltip: string;
}

const moveMenuFocus = (event: React.KeyboardEvent<HTMLDivElement>): void => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    return;
  }

  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')].filter((item) => !item.disabled);
  if (items.length === 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const currentIndex = items.findIndex((item) => item === event.currentTarget.ownerDocument.activeElement);
  let nextIndex: number;

  if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = items.length - 1;
  } else if (event.key === 'ArrowUp') {
    nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
  } else {
    nextIndex = currentIndex === -1 || currentIndex === items.length - 1 ? 0 : currentIndex + 1;
  }

  items[nextIndex]?.focus();
};

export const BrandSelect = ({
  ariaDescription,
  ariaLabel,
  children,
  disabled = false,
  onSelect,
  options,
  selectedId,
  tooltip,
}: BrandSelectProps): React.JSX.Element => {
  const [menuVisible, setMenuVisible] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedTitle = options.find(({ value }) => value === selectedId)?.title;
  const accessibleName = `${ariaLabel}${selectedTitle === undefined ? '' : ` ${selectedTitle}`}`;
  const menuId = `${TOOL_ID}-menu`;

  const trigger = (
    <IconButton
      active={!disabled && menuVisible}
      aria-controls={disabled ? undefined : menuId}
      aria-description={ariaDescription}
      aria-expanded={disabled ? undefined : menuVisible}
      aria-haspopup={disabled ? undefined : 'menu'}
      aria-label={accessibleName}
      disabled={disabled}
      ref={triggerRef}
      type="button"
    >
      <PaintBrushIcon aria-hidden="true" />
      {children}
    </IconButton>
  );

  if (disabled) {
    return (
      <WithTooltip key="status" placement="bottom" tooltip={tooltip} trigger="hover">
        {trigger}
      </WithTooltip>
    );
  }

  return (
    <WithTooltip
      closeOnOutsideClick
      interactive
      key="menu"
      onVisibleChange={setMenuVisible}
      placement="bottom"
      title={tooltip}
      tooltip={({ onHide }) => (
        <TooltipLinkList
          aria-label="Brands"
          id={menuId}
          links={options.map(({ value, title }) => {
            const active = value === selectedId;
            const select = () => {
              onSelect?.(value);
              onHide();
              triggerRef.current?.focus();
              requestAnimationFrame(() => triggerRef.current?.focus());
            };
            return {
              active,
              'aria-pressed': active,
              autoFocus: active,
              id: value,
              onClick: (event) => {
                event.preventDefault();
                select();
              },
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  select();
                }
              },
              title,
            };
          })}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              onHide();
              triggerRef.current?.focus();
              return;
            }
            moveMenuFocus(event);
          }}
          role="menu"
        />
      )}
      trigger="click"
    >
      {trigger}
    </WithTooltip>
  );
};

export const BrandSelectorPresentation = ({
  registration,
  parameters,
  storyGlobals,
  userGlobals,
  updateGlobals,
}: BrandSelectorPresentationProps): React.JSX.Element => {
  if (registration === undefined) {
    return (
      <BrandSelect
        ariaDescription={MISSING_CONFIGURATION_TOOLTIP}
        ariaLabel="Brand"
        disabled
        options={[]}
        tooltip={MISSING_CONFIGURATION_TOOLTIP}
      >
        Brand
      </BrandSelect>
    );
  }

  const state = resolveStoryBrandState(registration, parameters, storyGlobals, userGlobals, ignoreWarning);
  const options = state.allowedBrands.map(({ id, title }) => ({ value: id, title }));

  if (state.disabled) {
    return (
      <BrandSelect
        ariaDescription={DISABLED_TOOLTIP}
        ariaLabel="Brand switching disabled"
        disabled
        key="disabled"
        options={options}
        tooltip={DISABLED_TOOLTIP}
      >
        Brands disabled
      </BrandSelect>
    );
  }

  // A validated nonempty catalog always resolves a brand when the addon is enabled.
  const effectiveBrand = state.brand as NonNullable<typeof state.brand>;
  const mismatchLabel =
    typeof state.mismatch?.value === 'string'
      ? (registration.brands.find(({ id }) => id === state.mismatch?.value)?.title ??
        JSON.stringify(state.mismatch.value))
      : JSON.stringify(state.mismatch?.value);
  const tooltip = state.locked
    ? state.mismatch === undefined
      ? STORY_OVERRIDE_TOOLTIP
      : `Story brand ${mismatchLabel} is unavailable; using ${effectiveBrand.title}. The selector is locked by this story.`
    : state.mismatch === undefined
      ? 'Change brand'
      : `Saved brand ${mismatchLabel} is not available for this story; using ${effectiveBrand.title}.`;

  return (
    <BrandSelect
      ariaDescription={tooltip}
      ariaLabel={state.locked ? 'Brand set by story' : state.mismatch === undefined ? 'Brand' : 'Brand fallback'}
      disabled={state.locked}
      key="enabled"
      onSelect={(selectedId) => {
        if (
          !state.locked &&
          typeof selectedId === 'string' &&
          selectedId !== effectiveBrand.id &&
          state.allowedBrands.some(({ id }) => id === selectedId)
        ) {
          updateGlobals({ [BRAND_GLOBAL]: selectedId });
        }
      }}
      options={options}
      selectedId={effectiveBrand.id}
      tooltip={tooltip}
    >
      {effectiveBrand.title}
    </BrandSelect>
  );
};

export const BrandSelector = (): React.JSX.Element => {
  const [registration, setRegistration] = useState<BrandsRegistration>();
  const parameters = useParameter<unknown>(BRANDS_PARAMETER);
  const [, updateGlobals, storyGlobals, userGlobals] = useGlobals();
  const emit = useChannel(
    {
      [REGISTER_EVENT]: (nextRegistration: BrandsRegistration) => setRegistration(nextRegistration),
    },
    [],
  );

  useEffect(() => emit(REQUEST_EVENT), [emit]);

  return (
    <BrandSelectorPresentation
      parameters={parameters}
      registration={registration}
      storyGlobals={storyGlobals}
      updateGlobals={updateGlobals}
      userGlobals={userGlobals}
    />
  );
};

addons.register(ADDON_ID, () => {
  addons.add(TOOL_ID, {
    title: 'Brands',
    type: types.TOOL,
    match: ({ viewMode }) => viewMode === 'story',
    render: BrandSelector,
  });
});
