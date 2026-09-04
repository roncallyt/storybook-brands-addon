import React, { useEffect, useState } from 'react';
import { PaintBrushIcon } from '@storybook/icons';
import { Select } from 'storybook/internal/components';
import { addons, types, useChannel, useGlobals } from 'storybook/manager-api';

import { ADDON_ID, BRAND_GLOBAL, REGISTER_EVENT, REQUEST_EVENT, TOOL_ID } from './constants';
import type { BrandsRegistration, RegisteredBrand } from './protocol';

const MISSING_CONFIGURATION_TOOLTIP =
  'Configure brands with withBrands() in .storybook/preview.ts to enable brand selection.';
const STORY_OVERRIDE_TOOLTIP = 'Brand selection is set by this story and cannot be changed.';

export const resolveRegisteredBrand = (registration: BrandsRegistration, globalBrand: unknown): RegisteredBrand => {
  const selected =
    typeof globalBrand === 'string' ? registration.brands.find(({ id }) => id === globalBrand) : undefined;
  const projectDefault =
    registration.defaultBrand === undefined
      ? undefined
      : registration.brands.find(({ id }) => id === registration.defaultBrand);

  // Preview validation guarantees a nonempty catalog and a valid project default.
  return (selected ?? projectDefault ?? registration.brands[0]) as RegisteredBrand;
};

interface BrandSelectorPresentationProps {
  registration: BrandsRegistration | undefined;
  globals: Record<string, unknown>;
  storyGlobals: Record<string, unknown>;
  updateGlobals: (globals: Record<string, unknown>) => void;
}

export const BrandSelectorPresentation = ({
  registration,
  globals,
  storyGlobals,
  updateGlobals,
}: BrandSelectorPresentationProps): React.JSX.Element => {
  if (registration === undefined) {
    return (
      <Select ariaLabel="Brand" disabled icon={<PaintBrushIcon />} options={[]} tooltip={MISSING_CONFIGURATION_TOOLTIP}>
        Brand
      </Select>
    );
  }

  const effectiveBrand = resolveRegisteredBrand(registration, globals[BRAND_GLOBAL]);
  const isLocked = BRAND_GLOBAL in storyGlobals;

  return (
    <Select
      ariaLabel={isLocked ? 'Brand set by story' : 'Brand'}
      defaultOptions={effectiveBrand.id}
      disabled={isLocked}
      icon={<PaintBrushIcon />}
      onSelect={(selectedId) => {
        if (!isLocked && typeof selectedId === 'string' && registration.brands.some(({ id }) => id === selectedId)) {
          updateGlobals({ [BRAND_GLOBAL]: selectedId });
        }
      }}
      options={registration.brands.map(({ id, title }) => ({ value: id, title }))}
      tooltip={isLocked ? STORY_OVERRIDE_TOOLTIP : 'Change brand'}
    >
      {effectiveBrand.title}
    </Select>
  );
};

export const BrandSelector = (): React.JSX.Element => {
  const [registration, setRegistration] = useState<BrandsRegistration>();
  const [globals, updateGlobals, storyGlobals] = useGlobals();
  const emit = useChannel(
    {
      [REGISTER_EVENT]: (nextRegistration: BrandsRegistration) => setRegistration(nextRegistration),
    },
    [],
  );

  useEffect(() => emit(REQUEST_EVENT), [emit]);

  return (
    <BrandSelectorPresentation
      globals={globals}
      registration={registration}
      storyGlobals={storyGlobals}
      updateGlobals={updateGlobals}
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
