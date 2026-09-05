import type { Meta, StoryObj } from '@storybook/react-vite';

import { BrandShowcase } from './BrandShowcase';

const meta = {
  title: 'Brands/Showcase',
  component: BrandShowcase,
  tags: ['autodocs'],
  parameters: {
    brands: {
      docs: {
        allowed: ['orbit', 'canopy'],
        default: 'canopy',
      },
    },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof BrandShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unrestricted: Story = {};

export const StoryDefault: Story = {
  parameters: {
    brands: { default: 'canopy' },
  },
};

export const Restricted: Story = {
  parameters: {
    brands: { allowed: ['orbit'] },
  },
};

export const Disabled: Story = {
  parameters: {
    brands: { disabled: true },
  },
};

export const ForcedBrand: Story = {
  globals: {
    brand: 'canopy',
  },
};
