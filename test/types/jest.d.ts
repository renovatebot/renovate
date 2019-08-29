declare namespace jest {
  interface Matchers<R> {
    /**
     * only available in `test/website-docs.spec.js`
     * @param arg
     */
    toContainOption(arg: R): void;
  }
}
