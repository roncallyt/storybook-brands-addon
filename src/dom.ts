import { ADDON_ID } from './constants';
import type { NormalizedBrand, NormalizedBrandsConfig } from './config';

interface AttributeState {
  readonly existed: boolean;
  readonly value: string | null;
}

interface ElementState {
  readonly attributes: ReadonlyMap<string, AttributeState>;
  readonly classAttribute: AttributeState;
  readonly styleAttribute: AttributeState;
}

interface ActiveApplication {
  readonly state: ElementState;
  readonly owners: Map<object, BrandApplication>;
  activeToken: object | undefined;
}

interface BrandApplication {
  readonly brand: NormalizedBrand;
  readonly config: NormalizedBrandsConfig;
  readonly order: number;
}

const activeApplications = new WeakMap<Element, ActiveApplication>();
let applicationOrder = 0;

const snapshotAttribute = (element: Element, name: string): AttributeState => ({
  existed: element.hasAttribute(name),
  value: element.getAttribute(name),
});

const snapshotElement = (element: Element, attributeNames: readonly string[]): ElementState => ({
  attributes: new Map(attributeNames.map((name) => [name, snapshotAttribute(element, name)])),
  classAttribute: snapshotAttribute(element, 'class'),
  styleAttribute: snapshotAttribute(element, 'style'),
});

const restoreAttribute = (element: Element, name: string, state: AttributeState): void => {
  if (state.existed) {
    element.setAttribute(name, state.value ?? '');
  } else {
    element.removeAttribute(name);
  }
};

const restoreElement = (element: Element, state: ElementState): void => {
  state.attributes.forEach((attributeState, name) => {
    restoreAttribute(element, name, attributeState);
  });
  restoreAttribute(element, 'class', state.classAttribute);
  restoreAttribute(element, 'style', state.styleAttribute);
};

const hasStyleDeclaration = (element: Element): element is Element & { style: CSSStyleDeclaration } =>
  'style' in element &&
  typeof (element as Element & { style?: unknown }).style === 'object' &&
  typeof (element as Element & { style: CSSStyleDeclaration }).style.setProperty === 'function';

const warn = (message: string): void => {
  console.warn(`[${ADDON_ID}] ${message}`);
};

const applyToTarget = (
  target: Element & { style: CSSStyleDeclaration },
  state: ElementState,
  config: NormalizedBrandsConfig,
  brand: NormalizedBrand,
): boolean => {
  restoreElement(target, state);
  try {
    Object.entries(brand.attributes).forEach(([name, value]) => target.setAttribute(name, value));
    brand.classes.forEach((className) => target.classList.add(className));
    Object.entries(brand.cssVariables).forEach(([name, value]) => target.style.setProperty(name, value));
    return true;
  } catch {
    restoreElement(target, state);
    warn(`could not apply brand ${JSON.stringify(brand.id)} to target ${JSON.stringify(config.target)}`);
    return false;
  }
};

const latestOwner = (application: ActiveApplication): [object, BrandApplication] | undefined =>
  [...application.owners.entries()].sort(([, left], [, right]) => right.order - left.order)[0];

export const applyBrand = (
  canvasElement: Element,
  config: NormalizedBrandsConfig,
  brand: NormalizedBrand,
): (() => void) | undefined => {
  const document = canvasElement.ownerDocument;
  let target: Element | null;

  try {
    target = document.querySelector(config.target);
  } catch {
    warn(`target: invalid selector ${JSON.stringify(config.target)}`);
    return undefined;
  }

  if (target === null) {
    warn(`target: no element matches ${JSON.stringify(config.target)}`);
    return undefined;
  }
  if (!hasStyleDeclaration(target) || target.classList === undefined) {
    warn(`target: ${JSON.stringify(config.target)} does not match a suitable element`);
    return undefined;
  }

  const application =
    activeApplications.get(target) ??
    ({
      state: snapshotElement(target, config.attributeNames),
      owners: new Map(),
      activeToken: undefined,
    } satisfies ActiveApplication);
  const token = {};
  application.owners.set(token, { brand, config, order: applicationOrder++ });
  activeApplications.set(target, application);

  if (!applyToTarget(target, application.state, config, brand)) {
    application.owners.delete(token);
    const previous = latestOwner(application);
    if (previous === undefined) {
      activeApplications.delete(target);
    } else {
      application.activeToken = previous[0];
      applyToTarget(target, application.state, previous[1].config, previous[1].brand);
    }
    return undefined;
  }
  application.activeToken = token;

  return () => {
    const active = activeApplications.get(target);
    if (active !== application || !active.owners.has(token)) {
      return;
    }
    const wasActive = active.activeToken === token;
    active.owners.delete(token);
    if (active.owners.size === 0) {
      restoreElement(target, active.state);
      activeApplications.delete(target);
      return;
    }
    if (!wasActive) {
      return;
    }
    const next = latestOwner(active);
    if (next !== undefined) {
      active.activeToken = next[0];
      applyToTarget(target, active.state, next[1].config, next[1].brand);
    }
  };
};
