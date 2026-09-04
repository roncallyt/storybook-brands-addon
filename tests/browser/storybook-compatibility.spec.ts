import { expect, test, type FrameLocator, type Page } from '@playwright/test';

const storyIds = {
  docs: 'brands-showcase--docs',
  unrestricted: 'brands-showcase--unrestricted',
  storyDefault: 'brands-showcase--story-default',
  restricted: 'brands-showcase--restricted',
  disabled: 'brands-showcase--disabled',
  forced: 'brands-showcase--forced-brand',
} as const;

const brandStyles = {
  orbit: {
    className: 'brand-orbit',
    variables: {
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
    computed: {
      color: 'rgb(23, 37, 84)',
      backgroundColor: 'rgb(238, 242, 255)',
      fontFamily: '"Arial Narrow", "Avenir Next Condensed", Arial, sans-serif',
      border: '2px solid rgb(49, 46, 129)',
      borderRadius: '7px',
      boxShadow: 'rgb(34, 211, 238) 9px 9px 0px 0px',
      buttonBackground: 'rgb(67, 56, 202)',
    },
  },
  canopy: {
    className: 'brand-canopy',
    variables: {
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
    computed: {
      color: 'rgb(38, 58, 46)',
      backgroundColor: 'rgb(243, 239, 226)',
      fontFamily: 'Georgia, "Times New Roman", serif',
      border: '1px solid rgb(154, 137, 101)',
      borderRadius: '28px',
      boxShadow: 'rgba(45, 67, 52, 0.22) 0px 22px 55px 0px',
      buttonBackground: 'rgb(40, 89, 67)',
    },
  },
  harbor: {
    className: 'brand-harbor',
    variables: {
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
    computed: {
      color: 'rgb(67, 20, 7)',
      backgroundColor: 'rgb(255, 244, 237)',
      fontFamily: '"Courier New", Courier, monospace',
      border: '3px double rgb(122, 39, 26)',
      borderRadius: '2px',
      boxShadow: 'rgb(247, 144, 9) 0px 8px 0px 0px',
      buttonBackground: 'rgb(180, 35, 24)',
    },
  },
} as const;

const preview = (page: Page): FrameLocator => page.frameLocator('#storybook-preview-iframe');

const waitForShowcase = async (page: Page) => {
  const frame = preview(page);
  await expect(frame.getByTestId('brand-showcase')).toBeVisible();
  await expect(frame.locator('.sb-errordisplay:visible, #error-message:visible, #error-stack:visible')).toHaveCount(0);
  return frame;
};

const toolbar = (page: Page) => page.getByRole('combobox', { name: /^Brand/ });

const navigateInSidebar = async (page: Page, storyId: string) => {
  await page.locator(`[data-item-id="${storyId}"]`).click();
  await expect(page).toHaveURL(new RegExp(`path=/(?:story|docs)/${storyId}`));
};

const expectUrlBrand = async (page: Page, brand: string) => {
  await expect.poll(() => new URL(page.url()).searchParams.get('globals')).toContain(`brand:${brand}`);
};

const expectBrand = async (page: Page, brand: keyof typeof brandStyles) => {
  const frame = await waitForShowcase(page);
  const expected = brandStyles[brand];
  const readState = () =>
    frame.locator('html').evaluate((element) => {
      const showcase = element.querySelector<HTMLElement>('[data-testid="brand-showcase"]');
      const panel = element.querySelector<HTMLElement>('.brand-showcase__panel');
      const button = element.querySelector<HTMLElement>('[data-testid="brand-action"]');
      if (showcase === null || panel === null || button === null) {
        throw new Error('The showcase did not render its expected elements');
      }

      const showcaseStyle = getComputedStyle(showcase);
      const panelStyle = getComputedStyle(panel);
      const buttonStyle = getComputedStyle(button);

      return {
        brand: element.getAttribute('data-brand'),
        className: element.className,
        variables: Object.fromEntries(
          [
            '--brand-primary',
            '--brand-accent',
            '--brand-background',
            '--brand-surface',
            '--brand-text',
            '--brand-border',
            '--brand-radius',
            '--brand-font',
            '--brand-shadow',
          ].map((name) => [name, (element as HTMLElement).style.getPropertyValue(name)]),
        ),
        computed: {
          color: showcaseStyle.color,
          backgroundColor: showcaseStyle.backgroundColor,
          fontFamily: showcaseStyle.fontFamily,
          border: `${panelStyle.borderTopWidth} ${panelStyle.borderTopStyle} ${panelStyle.borderTopColor}`,
          borderRadius: panelStyle.borderTopLeftRadius,
          boxShadow: panelStyle.boxShadow,
          buttonBackground: buttonStyle.backgroundColor,
        },
      };
    });
  await expect.poll(async () => (await readState()).brand).toBe(brand);
  await expect
    .poll(async () => (await readState()).className.split(/\s+/))
    .toEqual(expect.arrayContaining(['fixture-baseline', 'fixture-shell', expected.className]));
  await expect.poll(async () => (await readState()).variables).toEqual(expected.variables);
  await expect.poll(async () => (await readState()).computed).toEqual(expected.computed);
};

const selectBrand = async (page: Page, brand: 'Orbit' | 'Canopy' | 'Harbor') => {
  await toolbar(page).selectOption({ label: brand });
  await expect(toolbar(page)).toHaveAccessibleName(new RegExp(`${brand}$`));
};

test(`packed addon integrates with Storybook ${process.env.STORYBOOK_VERSION ?? 'unknown'}`, async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`/?path=/story/${storyIds.unrestricted}`);
  await expect(toolbar(page)).toBeEnabled();
  await expect(toolbar(page)).toHaveAccessibleName('Brand Orbit');
  await expectBrand(page, 'orbit');

  await expect(toolbar(page).locator('option').allTextContents()).resolves.toEqual(['Orbit', 'Canopy', 'Harbor']);

  await selectBrand(page, 'Harbor');
  await expectBrand(page, 'harbor');
  await expectUrlBrand(page, 'harbor');

  await navigateInSidebar(page, storyIds.storyDefault);
  await expectBrand(page, 'harbor');
  await expect(toolbar(page)).toHaveAccessibleName('Brand Harbor');
  await expectUrlBrand(page, 'harbor');

  await selectBrand(page, 'Canopy');
  await expectBrand(page, 'canopy');
  await expectUrlBrand(page, 'canopy');

  await navigateInSidebar(page, storyIds.restricted);
  await expectBrand(page, 'orbit');
  await expect(toolbar(page)).toHaveAccessibleName('Brand fallback Orbit');
  await expect(toolbar(page).locator('option').allTextContents()).resolves.toEqual(['Orbit']);
  await expectUrlBrand(page, 'canopy');

  await navigateInSidebar(page, storyIds.unrestricted);
  await expectBrand(page, 'canopy');
  await expect(toolbar(page)).toHaveAccessibleName('Brand Canopy');

  await navigateInSidebar(page, storyIds.disabled);
  await expect(toolbar(page)).toBeDisabled();
  await expect(toolbar(page)).toHaveAccessibleName('Brand switching disabled');
  const disabledHtml = preview(page).locator('html');
  await expect(disabledHtml).toHaveAttribute('data-brand', 'fixture-baseline');
  await expect(disabledHtml).toHaveAttribute('data-fixture', 'preserved');
  await expect(disabledHtml).toHaveAttribute('class', 'fixture-baseline fixture-shell');
  await expect(disabledHtml).toHaveAttribute('style', '--fixture-existing: retained; color-scheme: light;');

  await navigateInSidebar(page, storyIds.unrestricted);
  await selectBrand(page, 'Orbit');
  await expectBrand(page, 'orbit');
  await expectUrlBrand(page, 'orbit');

  await navigateInSidebar(page, storyIds.forced);
  await expectBrand(page, 'canopy');
  await expect(toolbar(page)).toBeDisabled();
  await expect(toolbar(page)).toHaveAccessibleName('Brand set by story Canopy');
  await expectUrlBrand(page, 'orbit');

  await navigateInSidebar(page, storyIds.unrestricted);
  await expectBrand(page, 'orbit');
  await expect(toolbar(page)).toHaveAccessibleName('Brand Orbit');

  await navigateInSidebar(page, storyIds.docs);
  await expect(toolbar(page)).toHaveCount(0);
  await expect(preview(page).getByRole('heading', { name: 'Showcase' })).toBeVisible();
  const docsHtml = preview(page).locator('html');
  await expect(docsHtml).toHaveAttribute('data-brand', 'fixture-baseline');
  await expect(docsHtml).toHaveAttribute('class', 'fixture-baseline fixture-shell');
  await expect(docsHtml).toHaveAttribute('style', '--fixture-existing: retained; color-scheme: light;');

  expect(pageErrors).toEqual([]);
});
