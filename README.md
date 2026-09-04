# Storybook Brands Addon

> Pre-release: the package is currently version `0.0.0` and is not ready for production use.

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

Add the `withBrands` decorator in `.storybook/preview.ts`:

```ts
import type { Preview } from '@storybook/react-vite';
import { withBrands } from 'storybook-brands-addon';

const preview: Preview = {
  decorators: [
    withBrands({
      defaultBrand: 'alpha',
      target: 'html',
      brands: [
        {
          id: 'alpha',
          title: 'Alpha',
          attributes: { 'data-brand': 'alpha' },
          classes: ['brand-alpha'],
          cssVariables: {
            '--brand-primary': '#6633cc',
            '--brand-surface': '#ffffff',
            '--button-radius': '4px',
          },
        },
        {
          id: 'beta',
          title: 'Beta',
          attributes: { 'data-brand': 'beta' },
          classes: ['brand-beta'],
          cssVariables: {
            '--brand-primary': '#087f5b',
            '--brand-surface': '#f3fff9',
            '--button-radius': '999px',
          },
        },
      ],
    }),
  ],
};

export default preview;
```

The addon applies those values; it does not inject a consumer stylesheet. Define how your components use them in project CSS:

```css
.product-card {
  color: var(--brand-primary, #333333);
  background: var(--brand-surface, #ffffff);
  border-radius: var(--button-radius, 0.5rem);
}

[data-brand='beta'] .product-card {
  border-color: var(--brand-primary);
}

.brand-alpha .product-card__title {
  letter-spacing: -0.02em;
}
```

Fallback values are recommended so components still look intentional in stories where brand application is disabled.

## Public API

Alongside the default Storybook addon entry consumed by `addons`, the package root exposes the decorator, two constants, and three TypeScript interfaces for direct configuration:

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

interface BrandsParameters {
  allowed?: string[];
  default?: string;
  disabled?: boolean;
}
```

- `withBrands(config: BrandsConfig)` returns the Storybook decorator that registers the catalog and applies the effective brand.
- `BRAND_GLOBAL` is the string `"brand"`, the Storybook global used for selection.
- `BRANDS_PARAMETER` is the string `"brands"`, the key used for per-story parameters.
- `Brand`, `BrandsConfig`, and `BrandsParameters` are type-only exports.

### Configuration fields

`brands` is required and must be a nonempty array. Every brand requires:

- `id`: a unique, nonblank string. IDs are preserved exactly and are not trimmed or slugified.
- `title`: a nonblank label shown in the toolbar.

Every brand may also define:

- `attributes`: attribute names and string values to set on the target. Attribute names must be valid, and `class` and `style` must use their dedicated fields instead.
- `classes`: individual, nonempty, whitespace-free class tokens to add.
- `cssVariables`: valid CSS custom-property names beginning with `--`, with string values.

`BrandsConfig` also accepts:

- `defaultBrand`: the ID to use when there is no usable user or story selection. It must identify a configured brand.
- `target`: a CSS selector for the element that receives the brand. It defaults to `html` and is resolved in the Canvas preview document.

Calling `withBrands` validates and snapshots the complete project configuration synchronously. Invalid project configuration throws a `TypeError` immediately, including the failing field path. Later mutations to the object passed to `withBrands` do not change the registered catalog.

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

## Canvas and DOM behavior

The toolbar and brand application operate only for individual Canvas stories. Docs mode is left untouched. The target is queried from the Canvas element's owner document, which keeps the manager document isolated from preview changes.

On application, the addon sets configured attributes, adds configured class tokens, and writes configured custom properties as inline styles. Before doing so it snapshots the target's relevant attributes plus its complete `class` and `style` attributes. It restores those exact original values—including whether the attributes existed at all—before switching brands, when disabling the addon for a story, when leaving Canvas, and when the decorator unmounts. Unrelated attributes remain untouched.

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
