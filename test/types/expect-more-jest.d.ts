/**
 * partial from expect-more-jest
 * https://github.com/JamieMason/expect-more
 */
interface ExpectMoreMatchers<R> {
  /**
   * Asserts that a value is an `Array` including only the values provided in the given `allowedValues` array and no others. The order and number of times each value appears in either array does not matter. Returns true unless `value` contains a value which does not feature in `allowedValues`.
   * @example
   * expect([5, 10, 1]).toBeArrayIncludingOnly([1, 5, 10]);
   */
  toBeArrayIncludingOnly(allowedValues: unknown[]): R;

  /**
   * Asserts that a value is an `Array` where every member is equal to ${other}.
   * @example
   * expect([{ name: 'Guybrush' }, { name: 'Elaine' }]).toBeArrayOf({
   *   name: expect.toBeNonEmptyString()
   * });
   */
  toBeArrayOf(other: unknown): R;

  /**
   * Asserts that a value is an `Array` containing only `String` values.
   * @example
   * expect(['we', 'are', 'all', 'strings']).toBeArrayOfStrings();
   */
  toBeArrayOfStrings(): R;

  /**
   * Asserts that a value is a valid `Array` containing no items.
   * @example
   * expect([]).toBeEmptyArray();
   */
  toBeEmptyArray(): R;

  /**
   * Asserts that a value is a valid `String` containing no characters.
   * @example
   * expect('').toBeEmptyString();
   */
  toBeEmptyString(): R;

  /**
   * Asserts that a value is a `String` of valid JSON.
   * @example
   * expect('{"i":"am valid JSON"}').toBeJsonString();
   */
  toBeJsonString(): R;

  /**
   * Asserts that a value is an `Array` containing at least one value.
   * @example
   * expect(['i', 'am not empty']).toBeNonEmptyArray();
   */
  toBeNonEmptyArray(): R;

  /**
   * Asserts that a value is an `Object` containing at least one own member.
   * @example
   * expect({ i: 'am not empty' }).toBeNonEmptyObject();
   */
  toBeNonEmptyObject(): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends ExpectMoreMatchers<T> {}
  //   interface AsymmetricMatchersContaining<T = any> extends CustomMatchers<T> {}
  interface ExpectStatic extends ExpectMoreMatchers<any> {}
}

export {};
