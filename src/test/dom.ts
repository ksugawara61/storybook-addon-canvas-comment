// Test-only DOM helpers for jsdom-based tests.

/** jsdom does no layout, so give elements an explicit box. */
export const setRect = (
  element: Element,
  rect: { height: number; width: number; x: number; y: number },
) => {
  element.getBoundingClientRect = () =>
    new DOMRect(rect.x, rect.y, rect.width, rect.height);
};

export const query = (selector: string) => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
};

export const storyRoot = () => query("#storybook-root");

export const renderStory = (html: string) => {
  document.body.innerHTML = `<div id="storybook-root">${html}</div>`;
};
