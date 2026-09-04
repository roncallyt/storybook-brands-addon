import type { Preview } from '@storybook/react-vite';

import { withBrandsByDataAttribute } from '../src/index';

import './brand-tokens.css';

const preview: Preview = {
  decorators: [
    withBrandsByDataAttribute({
      defaultBrand: 'orbit',
      brands: [
        {
          id: 'orbit',
          title: 'Orbit',
        },
        {
          id: 'canopy',
          title: 'Canopy',
        },
      ],
    }),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
  initialGlobals: {
    background: { value: 'light' },
  },
};

export default preview;
