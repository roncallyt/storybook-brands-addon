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
  readonly token: object;
}

const activeApplications = new WeakMap<Element, ActiveApplication>();

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

  const previous = activeApplications.get(target);
  if (previous !== undefined) {
    restoreElement(target, previous.state);
    activeApplications.delete(target);
  }

  const state = snapshotElement(target, config.attributeNames);
  const token = {};
  activeApplications.set(target, { state, token });

  try {
    Object.entries(brand.attributes).forEach(([name, value]) => target.setAttribute(name, value));
    brand.classes.forEach((className) => target.classList.add(className));
    Object.entries(brand.cssVariables).forEach(([name, value]) => target.style.setProperty(name, value));
  } catch {
    restoreElement(target, state);
    activeApplications.delete(target);
    warn(`could not apply brand ${JSON.stringify(brand.id)} to target ${JSON.stringify(config.target)}`);
    return undefined;
  }

  return () => {
    const active = activeApplications.get(target);
    if (active?.token !== token) {
      return;
    }
    restoreElement(target, state);
    activeApplications.delete(target);
  };
};
