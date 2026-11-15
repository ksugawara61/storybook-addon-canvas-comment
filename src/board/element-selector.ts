const IMPLICIT_ROLES: Record<string, string> = {
  a: "link",
  button: "button",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  img: "img",
  input: "textbox",
  li: "listitem",
  select: "combobox",
  textarea: "textbox",
  ul: "list",
};

const LABEL_MAX_LENGTH = 40;

// jsdom has no CSS.escape, so ids that are not plain identifiers become attribute selectors.
const idSelector = (id: string): string =>
  /^[A-Za-z][\w-]*$/.test(id)
    ? `#${id}`
    : `[id="${id.replace(/["\\]/g, "\\$&")}"]`;

const truncate = (text: string): string =>
  text.length > LABEL_MAX_LENGTH ? `${text.slice(0, LABEL_MAX_LENGTH)}…` : text;

const segmentOf = (element: Element): string => {
  const tag = element.tagName.toLowerCase();
  const parent = element.parentElement;
  if (!parent) {
    return tag;
  }
  const sameTagSiblings = Array.from(parent.children).filter(
    (child) => child.tagName === element.tagName,
  );
  return sameTagSiblings.length === 1
    ? tag
    : `${tag}:nth-of-type(${sameTagSiblings.indexOf(element) + 1})`;
};

/**
 * Builds a CSS selector from root down to element.
 * Generated class names (CSS-in-JS, React Native Web) can change between builds,
 * so the path uses only ids and tag positions.
 */
export const buildSelector = (element: Element, root: Element): string => {
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current !== root) {
    if (
      current.id &&
      current.ownerDocument.querySelectorAll(idSelector(current.id)).length ===
        1
    ) {
      return [idSelector(current.id), ...segments].join(" > ");
    }
    segments.unshift(segmentOf(current));
    current = current.parentElement;
  }
  const rootSelector = root.id
    ? idSelector(root.id)
    : root.tagName.toLowerCase();
  return [rootSelector, ...segments].join(" > ");
};

const INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, label, [role], [tabindex]";

/**
 * Picks the element an instruction targets. Pressing text inside a button should target the button
 * (React Native Web renders a Pressable's Text as a separate element), so an interactive ancestor wins.
 * With `parent`, the target is one level further up.
 */
export const pickTarget = (
  element: Element,
  root: Element,
  options: { parent: boolean },
): Element | undefined => {
  const interactive = element.closest(INTERACTIVE_SELECTOR);
  const base =
    interactive && interactive !== root && root.contains(interactive)
      ? interactive
      : element;
  const picked = options.parent ? base.parentElement : base;
  return picked && picked !== root && root.contains(picked)
    ? picked
    : undefined;
};

/** Describes the element by role and name, so people and agents can tell which one it is. */
export const describeElement = (element: Element): string => {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role") ?? IMPLICIT_ROLES[tag] ?? tag;
  const name = (
    element.getAttribute("aria-label") ??
    element.getAttribute("alt") ??
    element.textContent ??
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
  return name ? `${role} "${truncate(name)}"` : role;
};
