import type * as vitest from 'vitest';

//------------------------------------------------
// Required global jest types
//------------------------------------------------
declare global {
  namespace jest {
    type MockInstance<T, Y extends any[]> = vitest.MockedFunction<
      (...args: Y) => T
    >;
    type SpyInstance<T, Y extends any[]> = vitest.MockInstance<
      (...args: Y) => T
    >;

    /** @deprecated */
    type Mocked<T> = vitest.MockedObject<T>;

    /**
     * @deprecated Use `MockedObject` from `vitest` instead
     */
    type MockedObject<T> = vitest.MockedObject<T>;

    /** @deprecated */
    type MockedFunction<T extends (...args: any[]) => any> =
      vitest.MockedFunction<T>;

    /** @deprecated */
    type Mock<T = any> = vitest.Mock<T>;
  }
}
