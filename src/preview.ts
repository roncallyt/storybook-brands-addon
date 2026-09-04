import type { ProjectAnnotations, Renderer } from 'storybook/internal/types';

import { BRAND_GLOBAL } from './constants';

const preview: ProjectAnnotations<Renderer> = {
  globalTypes: {
    [BRAND_GLOBAL]: {
      name: 'Brand',
    },
  },
};

export default preview;
