import type { Preview } from '@storybook/react-vite';

import { withBrands } from '../src/index';

const preview: Preview = {
  decorators: [
    withBrands({
      defaultBrand: 'orbit',
      target: 'html',
      brands: [
        {
          id: 'orbit',
          title: 'Orbit',
          attributes: { 'data-brand': 'orbit' },
          classes: ['brand-orbit'],
          cssVariables: {
            '--brand-primary': '#4338ca',
            '--brand-accent': '#22d3ee',
            '--brand-background': '#eef2ff',
            '--brand-surface': '#ffffff',
            '--brand-text': '#172554',
            '--brand-border': '2px solid #312e81',
            '--brand-radius': '7px',
            '--brand-font': "'Arial Narrow', 'Avenir Next Condensed', Arial, sans-serif",
            '--brand-shadow': '9px 9px 0 #22d3ee',
          },
        },
        {
          id: 'canopy',
          title: 'Canopy',
          attributes: { 'data-brand': 'canopy' },
          classes: ['brand-canopy'],
          cssVariables: {
            '--brand-primary': '#285943',
            '--brand-accent': '#d5a936',
            '--brand-background': '#f3efe2',
            '--brand-surface': '#fffdf6',
            '--brand-text': '#263a2e',
            '--brand-border': '1px solid #9a8965',
            '--brand-radius': '28px',
            '--brand-font': "Georgia, 'Times New Roman', serif",
            '--brand-shadow': '0 22px 55px rgb(45 67 52 / 22%)',
          },
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
