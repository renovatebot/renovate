// https://jest-extended.jestcommunity.dev/docs/matchers/
export interface CustomMatchers<R = unknown> extends Record<string, any> {
  toBeEmpty(): R;

  // Array
  toBeArray(): R;
  toBeArrayOfSize(num: number): R;
  toIncludeAllPartialMembers(members: unknown[]): R;

  // Boolean
  toBeTrue(): R;
  toBeFalse(): R;

  // Function
  toBeFunction(): R;

  /**
   * https://github.com/jest-community/jest-extended/blob/main/src/matchers/toThrowWithMessage.js
   * @param type
   * @param message
   */
  toThrowWithMessage(
    type:
      | (new (...args: any[]) => { message: string })
      | (abstract new (...args: any[]) => { message: string })
      | ((...args: any[]) => { message: string }),
    message: string | RegExp
  ): R;

  // Mock
  toHaveBeenCalledAfter(
    mock: import('vitest').MockInstance<any, any[]>,
    failIfNoFirstInvocation?: boolean
  ): R;

  toHaveBeenCalledBefore(
    mock: import('vitest').MockInstance<any, any[]>,
    failIfNoSecondInvocation?: boolean
  ): R;

  /**
   * https://github.com/jest-community/jest-extended/blob/main/src/matchers/toHaveBeenCalledExactlyOnceWith.js
   * @param args
   */
  toHaveBeenCalledExactlyOnceWith(...args: unknown[]): R;

  // Object

  toBeObject(): R;
  toBeEmptyObject(): R;
  toContainKey(key: string): R;
  toContainEntries(entries: [string, unknown][]): R;

  // Promise

  toResolve(): Promise<R>;
  toReject(): Promise<R>;

  // String
  toBeString(): R;
  toStartWith(other: string): R;
  toEndWith(other: string): R;
  toInclude(other: string): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
