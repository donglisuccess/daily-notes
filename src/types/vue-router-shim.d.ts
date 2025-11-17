// Minimal shim for `vue-router` types used by Element Plus d.ts files.
// If you use `vue-router` in your project, install it and remove/adjust this shim.

declare module 'vue-router' {
  export type RouteLocationRaw = any;
  export type NavigationFailure = any;
  export type RouteLocationNormalized = any;
  export type RouteRecordRaw = any;
  export function isNavigationFailure(e: any): boolean;
  export const RouterLink: any;
  export default {} as any;
}
