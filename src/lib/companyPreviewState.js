// The current editor state survives the in-app trip to the company preview.
let snapshot = null;

export function setCompanyPreview(content, reviewed) {
  snapshot = { content: structuredClone(content), reviewed: { ...reviewed } };
}

export function getCompanyPreview() { return snapshot; }
export function clearCompanyPreview() { snapshot = null; }
