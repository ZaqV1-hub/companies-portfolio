// React 18 (UMD, vendor/) + htm: JSX-like templates with no build step.
// Every component imports `html` and the hooks from here.
const React = window.React;

export const html = window.htm.bind(React.createElement);
export const { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } = React;
export { React };

// Joins class names, skipping falsy values: cx('a', on && 'b').
export function cx(...names) {
  return names.filter(Boolean).join(' ');
}
