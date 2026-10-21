/**
 * Ambient declarations for non-JavaScript imports.
 *
 * Vite handles these at build time; this file only exists so `tsc --checkJs`
 * can resolve them.
 */

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}
