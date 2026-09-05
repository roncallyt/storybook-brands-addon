import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const supportedVersions = new Set(['9.1.20', '10.6.0']);
const arguments_ = process.argv.slice(2).filter((argument) => argument !== '--');
const storybookVersion = arguments_[0];

if (arguments_.length !== 1 || storybookVersion === undefined || !supportedVersions.has(storybookVersion)) {
  console.error('Usage: pnpm test:browser -- <9.1.20|10.6.0>');
  process.exit(1);
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = await mkdtemp(join(tmpdir(), `storybook-brands-${storybookVersion}-`));
const storybookDirectory = join(fixtureRoot, '.storybook');
const sourceDirectory = join(fixtureRoot, 'src');
const staticDirectory = join(fixtureRoot, 'storybook-static');

const run = (command, args, options = {}) => {
  console.log(`\n> ${command} ${args.join(' ')}`);
  execFileSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
  });
};

const write = (path, contents) => writeFile(path, contents, 'utf8');

try {
  await mkdir(storybookDirectory, { recursive: true });
  await mkdir(sourceDirectory, { recursive: true });

  run('pnpm', ['pack', '--pack-destination', fixtureRoot]);

  const tarballs = (await readdir(fixtureRoot)).filter((name) => name.endsWith('.tgz'));
  if (tarballs.length !== 1) {
    throw new Error(`Expected one packed addon tarball, found ${tarballs.length}`);
  }

  await Promise.all([
    cp(join(projectRoot, 'src/stories/BrandShowcase.tsx'), join(sourceDirectory, 'BrandShowcase.tsx')),
    cp(join(projectRoot, 'src/stories/BrandShowcase.stories.ts'), join(sourceDirectory, 'BrandShowcase.stories.ts')),
    cp(join(projectRoot, 'src/stories/brand-showcase.css'), join(sourceDirectory, 'brand-showcase.css')),
  ]);

  await write(
    join(fixtureRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: `storybook-brands-consumer-${storybookVersion.replaceAll('.', '-')}`,
        private: true,
        type: 'module',
        scripts: { 'build-storybook': 'storybook build --quiet' },
      },
      null,
      2,
    )}\n`,
  );

  await write(
    join(storybookDirectory, 'main.ts'),
    `import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-docs', 'storybook-brands-addon'],
  framework: '@storybook/react-vite',
};

export default config;
`,
  );

  await write(
    join(storybookDirectory, 'preview.ts'),
    `import type { Preview } from '@storybook/react-vite';
import { withBrands } from 'storybook-brands-addon';

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
        {
          id: 'harbor',
          title: 'Harbor',
          attributes: { 'data-brand': 'harbor' },
          classes: ['brand-harbor'],
          cssVariables: {
            '--brand-primary': '#b42318',
            '--brand-accent': '#f79009',
            '--brand-background': '#fff4ed',
            '--brand-surface': '#fffaf5',
            '--brand-text': '#431407',
            '--brand-border': '3px double #7a271a',
            '--brand-radius': '2px',
            '--brand-font': "'Courier New', Courier, monospace",
            '--brand-shadow': '0 8px 0 #f79009',
          },
        },
      ],
    }),
  ],
};

export default preview;
`,
  );

  await write(
    join(storybookDirectory, 'preview-head.html'),
    `<script>
  document.documentElement.setAttribute('data-brand', 'fixture-baseline');
  document.documentElement.setAttribute('data-fixture', 'preserved');
  document.documentElement.setAttribute('class', 'fixture-baseline fixture-shell');
  document.documentElement.setAttribute('style', '--fixture-existing: retained; color-scheme: light;');
</script>
`,
  );

  await write(
    join(sourceDirectory, 'BrandShowcase.mdx'),
    `import { Meta, Story } from '@storybook/addon-docs/blocks';
import * as BrandShowcaseStories from './BrandShowcase.stories';
import * as OtherShowcaseStories from './OtherShowcase.stories';

<Meta of={BrandShowcaseStories} name="Brand Guide" />

# Attached brand guide

<Story of={BrandShowcaseStories.Restricted} />
<Story of={BrandShowcaseStories.Disabled} />
<Story of={BrandShowcaseStories.ForcedBrand} />
<Story of={OtherShowcaseStories.Default} />
`,
  );

  await write(
    join(sourceDirectory, 'OtherShowcase.stories.ts'),
    `import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrandShowcase } from './BrandShowcase';

const meta = {
  title: 'Brands/Other Showcase',
  component: BrandShowcase,
  tags: ['autodocs'],
  parameters: {
    brands: { docs: { allowed: ['harbor'], default: 'harbor' } },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof BrandShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
`,
  );

  await write(
    join(sourceDirectory, 'DisabledDocs.stories.ts'),
    `import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrandShowcase } from './BrandShowcase';

const meta = {
  title: 'Brands/Disabled Docs',
  component: BrandShowcase,
  tags: ['autodocs'],
  parameters: {
    brands: { docs: { disabled: true } },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof BrandShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
`,
  );

  await write(
    join(sourceDirectory, 'StandaloneGuide.mdx'),
    `import { Meta, Story } from '@storybook/addon-docs/blocks';
import * as BrandShowcaseStories from './BrandShowcase.stories';

<Meta title="Guides/Standalone" />

# Standalone guide

<Story of={BrandShowcaseStories.Unrestricted} />
`,
  );

  const tarballPath = join(fixtureRoot, tarballs[0]);
  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--save-exact',
      `storybook@${storybookVersion}`,
      `@storybook/react-vite@${storybookVersion}`,
      `@storybook/addon-docs@${storybookVersion}`,
      'react@18.3.1',
      'react-dom@18.3.1',
      tarballPath,
    ],
    { cwd: fixtureRoot },
  );
  run('npm', ['run', 'build-storybook'], { cwd: fixtureRoot });

  const index = JSON.parse(await readFile(join(staticDirectory, 'index.json'), 'utf8'));
  const expectedEntries = [
    'brands-showcase--docs',
    'brands-showcase--brand-guide',
    'brands-showcase--unrestricted',
    'brands-showcase--story-default',
    'brands-showcase--restricted',
    'brands-showcase--disabled',
    'brands-showcase--forced-brand',
    'brands-other-showcase--docs',
    'brands-other-showcase--default',
    'brands-disabled-docs--docs',
    'brands-disabled-docs--default',
    'guides-standalone--docs',
  ];
  const missingEntries = expectedEntries.filter((id) => index.entries?.[id] === undefined);
  if (missingEntries.length > 0) {
    throw new Error(`Consumer index is missing expected entries: ${missingEntries.join(', ')}`);
  }

  run('pnpm', ['exec', 'playwright', 'test', '--config', 'playwright.config.ts'], {
    env: {
      STORYBOOK_STATIC_DIRECTORY: staticDirectory,
      STORYBOOK_VERSION: storybookVersion,
    },
  });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
