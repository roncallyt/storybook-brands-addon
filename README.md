# Storybook Brands Addon

Switch between consumer-defined brands from the Storybook toolbar. A brand can apply attributes, classes, and CSS custom properties to one preview element, with per-story restrictions and a selection that follows Storybook navigation and URLs.

## When to use this addon

Use Storybook's [native toolbar globals](https://storybook.js.org/docs/essentials/toolbars-and-globals) when you only need a simple custom global and are comfortable wiring its behavior yourself. Use [`@storybook/addon-themes`](https://storybook.js.org/docs/essentials/themes) for conventional switching based on a class, data attribute, or provider.

This addon is intended for multi-brand catalogs where each selection may combine attributes, classes, and CSS variables, stories need to limit the available brands, and the reader's selection should persist while navigating Storybook.

## Installation

Install the addon as a development dependency:

```sh
pnpm add -D storybook-brands-addon
```

Register it in `.storybook/main.ts`:

```ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  addons: ['storybook-brands-addon'],
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
};

export default config;
```

The addon preview behavior is renderer-independent; the framework import above is only an example.

## Configure brands

Data attributes are the recommended setup. Define brand tokens in one global stylesheet, import it once from `.storybook/preview.ts`, and let components consume semantic variables.

```css
/* .storybook/brand-tokens.css */
:root[data-brand='alpha'] {
  --brand-primary: #6633cc;
  --brand-surface: #ffffff;
  --button-radius: 4px;
}

:root[data-brand='beta'] {
  --brand-primary: #087f5b;
  --brand-surface: #f3fff9;
  --button-radius: 999px;
}
```

```ts
// .storybook/preview.ts
import type { Preview } from '@storybook/react-vite';
import { withBrandsByDataAttribute } from 'storybook-brands-addon';

import './brand-tokens.css';

const preview: Preview = {
  decorators: [
    withBrandsByDataAttribute({
      brands: [
        { id: 'alpha', title: 'Alpha' },
        { id: 'beta', title: 'Beta' },
      ],
    }),
  ],
};

export default preview;
```

By default the helper writes the selected ID to `data-brand` on `<html>`. Components only need their normal structural CSS:

```css
.product-card {
  color: var(--brand-primary, #333333);
  background: var(--brand-surface, #ffffff);
  border-radius: var(--button-radius, 0.5rem);
}
```

Fallback values are recommended so components still look intentional in stories where brand application is disabled.

### Class-based activation

Use `withBrandsByClassName` when an existing theme stylesheet is selected by classes:

```ts
import { withBrandsByClassName } from 'storybook-brands-addon';

export default {
  decorators: [
    withBrandsByClassName({
      brands: [
        { id: 'alpha', title: 'Alpha', className: 'theme-alpha compact' },
        { id: 'beta', title: 'Beta', className: 'theme-beta rounded' },
      ],
    }),
  ],
};
```

Each `className` may contain one or more whitespace-separated class tokens. They are added to `<html>` by default.

### Combined attributes, classes, and inline variables

The original `withBrands` API remains available for catalogs that need to combine activation strategies or calculate CSS variables in TypeScript:

```ts
import { withBrands } from 'storybook-brands-addon';

export default {
  decorators: [
    withBrands({
      brands: [
        {
          id: 'alpha',
          title: 'Alpha',
          attributes: { 'data-brand': 'alpha' },
          classes: ['theme-alpha'],
          cssVariables: { '--brand-primary': '#6633cc' },
        },
      ],
    }),
  ],
};
```

The addon applies the configured activation values; it does not inject a consumer stylesheet.

### Choosing an activation strategy

- Prefer `withBrandsByDataAttribute` for a design system whose semantic tokens live in a global stylesheet.
- Use `withBrandsByClassName` when an existing theme stylesheet is already activated by one or more classes.
- Use `withBrands` when a brand must combine attributes, classes, and inline variables, or when variables are generated from synchronous project data.

Provider components and provider callbacks are intentionally unsupported. They are renderer-specific, while this addon's preview behavior remains renderer-independent. Use a framework decorator or a provider-capable theming addon when a React, Vue, or other renderer context must change with the selected theme.

## Migrating from v0.1

Existing `withBrands()` configurations require no code changes in v0.2. The original types, global key, per-story controls, selection precedence, and DOM activation behavior remain supported; the data-attribute and class-name helpers are optional conveniences.

V0.2 also applies the selected project brand to Autodocs and attached MDX pages. To retain v0.1's unbranded Docs behavior for a component, set `parameters.brands.docs.disabled` to `true` on its component metadata. Standalone MDX remains unbranded automatically.

## Public API

Alongside the default Storybook addon entry consumed by `addons`, the package root exposes three decorators, two constants, and their TypeScript configuration interfaces:

```ts
interface Brand {
  id: string;
  title: string;
  attributes?: Record<string, string>;
  classes?: string[];
  cssVariables?: Record<`--${string}`, string>;
}

interface BrandsConfig {
  brands: Brand[];
  defaultBrand?: string;
  target?: string;
}

interface DataAttributeBrand {
  id: string;
  title: string;
  value?: string;
}

interface DataAttributeBrandsConfig {
  brands: DataAttributeBrand[];
  defaultBrand?: string;
  target?: string;
  attributeName?: string;
}

interface ClassNameBrand {
  id: string;
  title: string;
  className: string;
}

interface ClassNameBrandsConfig {
  brands: ClassNameBrand[];
  defaultBrand?: string;
  target?: string;
}

interface BrandsParameters {
  allowed?: string[];
  default?: string;
  disabled?: boolean;
  docs?: BrandsDocsParameters;
}

interface BrandsDocsParameters {
  allowed?: string[];
  default?: string;
  disabled?: boolean;
}
```

- `withBrandsByDataAttribute(config: DataAttributeBrandsConfig)` activates a brand through one attribute.
- `withBrandsByClassName(config: ClassNameBrandsConfig)` activates a brand through one or more class tokens.
- `withBrands(config: BrandsConfig)` returns the Storybook decorator that registers the catalog and applies the effective brand.
- `BRAND_GLOBAL` is the string `"brand"`, the Storybook global used for selection.
- `BRANDS_PARAMETER` is the string `"brands"`, the key used for per-story parameters.
- All interfaces shown above are type-only exports.

### Configuration fields

Every decorator requires a nonempty `brands` array. Every brand requires:

- `id`: a unique, nonblank string. IDs are preserved exactly and are not trimmed or slugified.
- `title`: a nonblank label shown in the toolbar.

The data-attribute helper accepts an optional `value` per brand, defaulting to its exact `id`. Its config accepts `attributeName`, defaulting to `data-brand`. Attribute names must be valid and cannot be `class` or `style`.

The class-name helper requires `className` on every brand. It accepts one or more tokens separated by ASCII whitespace.

The advanced `withBrands` API also accepts:

- `attributes`: attribute names and string values to set on the target. Attribute names must be valid, and `class` and `style` must use their dedicated fields instead.
- `classes`: individual, nonempty, whitespace-free class tokens to add.
- `cssVariables`: valid CSS custom-property names beginning with `--`, with string values.

Every config also accepts:

- `defaultBrand`: the ID to use when there is no usable user or story selection. It must identify a configured brand.
- `target`: a CSS selector for the element that receives the brand. It defaults to `html` and is resolved in the active preview document.

Calling any decorator validates and snapshots the complete project configuration synchronously. Invalid project configuration throws a `TypeError` immediately, including the failing field path. Later mutations to the supplied object do not change the registered catalog.

## Per-story controls

Set `parameters.brands` on a component or story:

```ts
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  component: ProductCard,
} satisfies Meta<typeof ProductCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AlphaOnly: Story = {
  parameters: {
    brands: {
      allowed: ['alpha'],
      default: 'alpha',
    },
  },
};

export const WithoutBrand: Story = {
  parameters: {
    brands: { disabled: true },
  },
};
```

- `allowed` limits the toolbar options and fallback candidates to known IDs. Options retain project catalog order. An empty list or a list with no known IDs is warned about and ignored.
- `default` is a non-locking fallback for that story. It must be configured and included by `allowed` when a restriction exists.
- `disabled` removes addon-owned DOM changes and disables the selector for that story.

Invalid story metadata is ignored with a console warning rather than breaking the story. Valid entries in a partly invalid `allowed` list still take effect.

### Force and lock a brand

A story-level global is a hard override:

```ts
export const AlwaysBeta: Story = {
  globals: {
    brand: 'beta',
  },
};
```

This locks the toolbar selector. A valid forced brand wins even when it is outside `parameters.brands.allowed`; the addon applies it and warns about the conflict. An invalid forced value also leaves the selector locked while normal fallback resolution continues.

### Effective-brand precedence

When `parameters.brands.disabled` is not `true`, the addon resolves the effective brand in this order:

1. A valid story-level `globals.brand` hard override.
2. A valid, allowed user or URL `brand` global.
3. A valid, allowed `parameters.brands.default`.
4. The project `defaultBrand`, if allowed.
5. The first allowed brand in project catalog order.

An unknown or malformed global warns and falls back. If a saved user brand is valid in the project but excluded by the current story, the addon temporarily displays and applies the story's fallback without overwriting that saved selection. Navigating to a compatible story makes the saved brand effective again.

Selecting a brand updates Storybook's `brand` global, so Storybook carries it through story navigation and its globals URL state. Story-level globals remain story metadata and do not replace the user's saved selection.

## Component Docs

Set `parameters.brands.docs` on component metadata to control one brand across an Autodocs or attached MDX page:

```ts
const meta = {
  component: ProductCard,
  parameters: {
    brands: {
      docs: {
        allowed: ['alpha', 'beta'],
        default: 'beta',
      },
    },
  },
} satisfies Meta<typeof ProductCard>;
```

Docs first uses a valid saved or URL brand allowed by `docs.allowed`, followed by `docs.default`, the allowed project default, and the first allowed project brand. Embedded stories' own brand restrictions, defaults, disabling, and forced globals are ignored so that the whole page stays coherent. A disabled Docs configuration restores the preview DOM and disables the selector.

The selector and brand application support Autodocs and MDX attached with `<Meta of={Stories}>`. Standalone MDX without an owning component is left unchanged, even when it embeds story canvases.

## Preview and DOM behavior

The toolbar displays the effective brand beside its icon and opens the same dropdown for catalogs of any size. The target is queried from the Canvas or Docs element's owner document, which keeps the manager document isolated from preview changes.

On application, the addon sets configured attributes, adds configured class tokens, and writes configured custom properties as inline styles. Before doing so it snapshots the target's relevant attributes plus its complete `class` and `style` attributes. It restores those exact original values—including whether the attributes existed at all—before switching brands, when disabling the addon, when leaving a supported view, and when the final decorator owner unmounts. Unrelated attributes remain untouched.

An invalid selector, a selector with no match, or a matched element that cannot accept classes and inline styles produces a non-fatal console warning and no brand mutation.

## Catalogs of any size

Two brands are only a common starting point. `brands` accepts an ordinary array of any length, and that array may be assembled synchronously from project data already imported into the preview bundle:

```ts
import type { Brand } from 'storybook-brands-addon';
import { withBrands } from 'storybook-brands-addon';
import { organizations } from '../src/brand-data';

const brands: Brand[] = organizations.map((organization) => ({
  id: organization.slug,
  title: organization.name,
  attributes: { 'data-brand': organization.slug },
  classes: [`brand-${organization.slug}`],
  cssVariables: {
    '--brand-primary': organization.colors.primary,
    '--brand-surface': organization.colors.surface,
  },
}));

export default {
  decorators: [withBrands({ brands, defaultBrand: brands[0]?.id })],
};
```

The catalog is resolved when the Storybook preview bundle loads. Runtime fetching, async catalog refreshes, loading states, and remote brand resolution are outside this API; import or generate the data synchronously before calling `withBrands`.

## Compatibility

The package requires Node.js 20.19 or newer and declares Storybook `^9.0.0 || ^10.0.0` as a peer dependency. Browser integration is tested against Storybook 9.1.20 and 10.6.0. It is ESM-only.
