import React, { useEffect, useRef, useState } from 'react';
import { PaintBrushIcon } from '@storybook/icons';
import { IconButton, TooltipLinkList, WithTooltip } from 'storybook/internal/components';
import {
  addons,
  types,
  useChannel,
  useGlobals,
  useParameter,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';

import {
  ADDON_ID,
  BRAND_GLOBAL,
  BRANDS_PARAMETER,
  DOCS_CONTEXT_EVENT,
  DOCS_CONTEXT_REQUEST_EVENT,
  DOCS_PARAMETERS_EVENT,
  REGISTER_EVENT,
  REQUEST_EVENT,
  TOOL_ID,
} from './constants';
import type { BrandsRegistration, DocsBrandContext, DocsParametersReport } from './protocol';
import { resolveDocsBrandState, resolveStoryBrandState } from './storyState';

const MISSING_CONFIGURATION_TOOLTIP =
  'Configure brands with withBrandsByDataAttribute() or another brand decorator in .storybook/preview.ts to enable brand selection.';
const STORY_OVERRIDE_TOOLTIP = 'Brand selection is set by this story and cannot be changed.';
const DISABLED_TOOLTIP = 'Brand switching is disabled for this story.';
const DOCS_DISABLED_TOOLTIP = 'Brand switching is disabled for this Docs page.';
const ignoreWarning = (): void => undefined;

type SupportedViewMode = 'story' | 'docs';

interface BrandSelectorPresentationProps {
  registration: BrandsRegistration | undefined;
  parameters: unknown;
  storyGlobals: Record<string, unknown>;
  userGlobals: Record<string, unknown>;
  updateGlobals: (globals: Record<string, unknown>) => void;
  viewMode?: SupportedViewMode;
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
  viewMode = 'story',
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

  const state =
    viewMode === 'docs'
      ? resolveDocsBrandState(registration, parameters, userGlobals, ignoreWarning)
      : resolveStoryBrandState(registration, parameters, storyGlobals, userGlobals, ignoreWarning);
  const options = state.allowedBrands.map(({ id, title }) => ({ value: id, title }));

  if (state.disabled) {
    const disabledTooltip = viewMode === 'docs' ? DOCS_DISABLED_TOOLTIP : DISABLED_TOOLTIP;
    return (
      <BrandSelect
        ariaDescription={disabledTooltip}
        ariaLabel="Brand switching disabled"
        disabled
        key="disabled"
        options={options}
        tooltip={disabledTooltip}
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
      : `Saved brand ${mismatchLabel} is not available for this ${viewMode === 'docs' ? 'Docs page' : 'story'}; using ${effectiveBrand.title}.`;

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

interface DocsEntryLike {
  readonly parent?: string;
  readonly tags?: readonly string[];
  readonly type?: string;
}

export const supportsBrandDocsEntry = (entry: DocsEntryLike | undefined): boolean =>
  entry?.type === 'docs' &&
  (entry.tags?.includes('autodocs') === true || entry.tags?.includes('attached-mdx') === true);

export const BrandSelector = (): React.JSX.Element | null => {
  const [registration, setRegistration] = useState<BrandsRegistration>();
  const [docsParametersReport, setDocsParametersReport] = useState<DocsParametersReport>();
  const parameters = useParameter<unknown>(BRANDS_PARAMETER);
  const [, updateGlobals, storyGlobals, userGlobals] = useGlobals();
  const api = useStorybookApi();
  const { storyId, viewMode } = useStorybookState();
  let docsSupported = false;
  let ownerComponentId: string | undefined;
  if (viewMode === 'docs' && storyId !== undefined) {
    try {
      const entry = api.getData(storyId);
      docsSupported = supportsBrandDocsEntry(entry);
      ownerComponentId = docsSupported ? entry.parent : undefined;
    } catch {
      docsSupported = false;
    }
  }
  const docsParametersReady =
    docsParametersReport?.pageId === storyId && docsParametersReport.componentId === ownerComponentId;
  const docsParameters = docsParametersReady ? docsParametersReport.parameters : undefined;
  const docsState =
    docsSupported && docsParametersReady && registration !== undefined
      ? resolveDocsBrandState(registration, docsParameters, userGlobals, ignoreWarning)
      : undefined;
  const docsContext: DocsBrandContext = {
    pageId: storyId ?? '',
    ownerComponentId,
    supported: docsSupported,
    disabled: docsState?.disabled ?? false,
    brandId: docsState?.brand?.id,
  };
  const docsContextRef = useRef(docsContext);
  docsContextRef.current = docsContext;
  const emit = useChannel(
    {
      [DOCS_CONTEXT_REQUEST_EVENT]: () => emit(DOCS_CONTEXT_EVENT, docsContextRef.current),
      [DOCS_PARAMETERS_EVENT]: (report: DocsParametersReport) => {
        const current = docsContextRef.current;
        if (current.supported && report.pageId === current.pageId && report.componentId === current.ownerComponentId) {
          setDocsParametersReport((existingReport) =>
            existingReport?.pageId === report.pageId && existingReport.componentId === report.componentId
              ? existingReport
              : report,
          );
        }
      },
      [REGISTER_EVENT]: (nextRegistration: BrandsRegistration) => setRegistration(nextRegistration),
    },
    [],
  );

  useEffect(() => emit(REQUEST_EVENT), [emit]);
  useEffect(() => {
    if (viewMode === 'docs') {
      emit(DOCS_CONTEXT_EVENT, docsContextRef.current);
    }
  }, [
    docsContext.brandId,
    docsContext.disabled,
    docsContext.ownerComponentId,
    docsContext.pageId,
    docsContext.supported,
    emit,
    viewMode,
  ]);
  useEffect(() => {
    if (docsSupported && docsParametersReady && registration !== undefined) {
      resolveDocsBrandState(registration, docsParameters, userGlobals);
    }
  }, [docsParameters, docsParametersReady, docsSupported, registration, userGlobals]);

  if (viewMode === 'docs' && !docsSupported) {
    return null;
  }

  return (
    <BrandSelectorPresentation
      parameters={viewMode === 'docs' ? docsParameters : parameters}
      registration={registration}
      storyGlobals={storyGlobals}
      updateGlobals={updateGlobals}
      userGlobals={userGlobals}
      viewMode={viewMode === 'docs' ? 'docs' : 'story'}
    />
  );
};

addons.register(ADDON_ID, () => {
  addons.add(TOOL_ID, {
    title: 'Brands',
    type: types.TOOL,
    match: ({ viewMode }) => viewMode === 'story' || viewMode === 'docs',
    render: BrandSelector,
  });
});
