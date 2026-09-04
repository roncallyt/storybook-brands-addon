import React, { useEffect, useState } from 'react';
import { PaintBrushIcon } from '@storybook/icons';
import { Select } from 'storybook/internal/components';
import { addons, types, useChannel, useGlobals, useParameter } from 'storybook/manager-api';

import { ADDON_ID, BRAND_GLOBAL, BRANDS_PARAMETER, REGISTER_EVENT, REQUEST_EVENT, TOOL_ID } from './constants';
import type { BrandsRegistration } from './protocol';
import { resolveStoryBrandState } from './storyState';

const MISSING_CONFIGURATION_TOOLTIP =
  'Configure brands with withBrands() in .storybook/preview.ts to enable brand selection.';
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

export const BrandSelectorPresentation = ({
  registration,
  parameters,
  storyGlobals,
  userGlobals,
  updateGlobals,
}: BrandSelectorPresentationProps): React.JSX.Element => {
  if (registration === undefined) {
    return (
      <Select
        ariaDescription={MISSING_CONFIGURATION_TOOLTIP}
        ariaLabel="Brand"
        disabled
        icon={<PaintBrushIcon />}
        options={[]}
        tooltip={MISSING_CONFIGURATION_TOOLTIP}
      >
        Brand
      </Select>
    );
  }

  const state = resolveStoryBrandState(registration, parameters, storyGlobals, userGlobals, ignoreWarning);
  const options = state.allowedBrands.map(({ id, title }) => ({ value: id, title }));

  if (state.disabled) {
    return (
      <Select
        ariaDescription={DISABLED_TOOLTIP}
        ariaLabel="Brand switching disabled"
        disabled
        icon={<PaintBrushIcon />}
        options={options}
        tooltip={DISABLED_TOOLTIP}
      >
        Brands disabled
      </Select>
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
    <Select
      ariaDescription={tooltip}
      ariaLabel={state.locked ? 'Brand set by story' : state.mismatch === undefined ? 'Brand' : 'Brand fallback'}
      defaultOptions={effectiveBrand.id}
      disabled={state.locked}
      icon={<PaintBrushIcon />}
      onSelect={(selectedId) => {
        if (
          !state.locked &&
          typeof selectedId === 'string' &&
          state.allowedBrands.some(({ id }) => id === selectedId)
        ) {
          updateGlobals({ [BRAND_GLOBAL]: selectedId });
        }
      }}
      options={options}
      tooltip={tooltip}
    >
      {effectiveBrand.title}
    </Select>
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
