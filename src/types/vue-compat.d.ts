import type { ExtractPublicPropTypes } from 'vue';

declare module 'vue' {
  // Element Plus expects an internal alias name `__ExtractPublicPropTypes` in some d.ts files.
  // Provide a compatibility alias to the public type so type-checking succeeds.
  export type __ExtractPublicPropTypes<T> = ExtractPublicPropTypes<T>;
}
