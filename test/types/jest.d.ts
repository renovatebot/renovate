declare namespace jest {
  interface Matchers<R, T> {
    /**
     * only available in `test/website-docs.spec.js`
     * @param arg
     */
    toContainOption(arg: T): void;
  }
}
