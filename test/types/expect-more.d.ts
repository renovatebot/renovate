import 'vitest';

interface CustomMatchers<R = unknown> {
  /**
   * https://github.com/JamieMason/expect-more/blob/master/packages/expect-more-jest/src/to-be-array-of.ts
   * @param other
   */
  toBeArrayOf(other: unknown): R;

  /**
   * https://github.com/JamieMason/expect-more/blob/master/packages/expect-more-jest/src/to-be-array-including-only.ts
   * @param other
   */
  toBeArrayIncludingOnly(other: unknown[]): R;

  toBeEmptyArray(): R;

  toBeNonEmptyArray(): R;

  toBeJsonString(): R;

  toBeEmptyString(): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

declare global {
  namespace jest {
    interface CustomMatcherResult {
      pass: boolean;
      message: string | (() => string);
    }
  }
}
