import type { AsymmetricMatchers, BaseExpect, Matchers } from 'expect';
import type { SnapshotMatchers } from 'jest-snapshot';
import type { Global } from '@jest/types';
import type { Jest } from '@jest/environment';
import type {
  ClassLike,
  FunctionLike,
  MockInstance as JestMockInstance,
  Mocked as JestMocked,
  MockedClass as JestMockedClass,
  MockedFunction as JestMockedFunction,
  MockedObject as JestMockedObject,
  SpyInstance as JestSpyInstance,
} from 'jest-mock';

//------------------------------------------------
// Required global jest types
//------------------------------------------------
declare global {
  // Extension point for jest matchers
  type JestMatchers<R, T = any> = jest.Matchers<R> &
    SnapshotMatchers<R extends void | Promise<void> ? R : void, T> &
    Omit<
      Matchers<R extends void | Promise<void> ? R : void>,
      'toMatchObject'
    > & {
      // TODO: override, because type issues (#22198)
      /**
       * Used to check that a JavaScript object matches a subset of the properties of an object
       *
       * Optionally, you can provide an object to use as Generic type for the expected value.
       * This ensures that the matching object matches the structure of the provided object-like type.
       *
       * @example
       *
       * type House = {
       *   bath: boolean;
       *   bedrooms: number;
       *   kitchen: {
       *     amenities: string[];
       *     area: number;
       *     wallColor: string;
       *   }
       * };
       *
       * expect(desiredHouse).toMatchObject<House>({...standardHouse, kitchen: {area: 20}}) // wherein standardHouse is some base object of type House
       */
      toMatchObject<E extends object | any[]>(
        expected: E,
      ): R extends void | Promise<void> ? R : void;
    };
}

type JestInverse<Matchers> = {
  /**
   * Inverse next matcher. If you know how to test something, `.not` lets you test its opposite.
   */
  not: Matchers;
};

type JestPromiseMatchers<T> = {
  /**
   * Unwraps the reason of a rejected promise so any other matcher can be chained.
   * If the promise is fulfilled the assertion fails.
   */
  rejects: JestMatchers<Promise<void>, T> &
    JestInverse<JestMatchers<Promise<void>, T>>;
  /**
   * Unwraps the value of a fulfilled promise so any other matcher can be chained.
   * If the promise is rejected the assertion fails.
   */
  resolves: JestMatchers<Promise<void>, T> &
    JestInverse<JestMatchers<Promise<void>, T>>;
};

type JestExpect = {
  <T = unknown>(
    actual: T,
  ): JestMatchers<void, T> &
    JestInverse<JestMatchers<void, T>> &
    JestPromiseMatchers<T>;
  addSnapshotSerializer: (arg: Plugin) => void;
} & BaseExpect &
  AsymmetricMatchers &
  JestInverse<Omit<AsymmetricMatchers, 'any' | 'anything'>> &
  jest.Expect;

type JestItEach = Global.It['each'];

interface JestEach extends JestItEach {
  (
    strings: TemplateStringsArray,
    ...placeholders: any[]
  ): (
    name: string,
    fn: (arg: any) => ReturnType<Global.TestFn>,
    timeout?: number,
  ) => void;
}

interface JestIt extends Global.It {
  // TODO: override, because type issues (#22198)
  each: JestEach;
}

declare global {
  const afterAll: Global.HookBase;
  const afterEach: Global.HookBase;
  const beforeAll: Global.HookBase;
  const beforeEach: Global.HookBase;
  const describe: Global.Describe;
  const expect: JestExpect;
  const it: JestIt;
  var jest: Omit<Jest, 'fn'> & {
    // TODO: override, because type issues (#22198)
    fn(): jest.Mock;
    fn<T, Y extends any[]>(implementation?: (...args: Y) => T): jest.Mock<T, Y>;
  };
  const test: JestIt;

  namespace jest {
    /**
     * Wraps a class, function or object type with Jest mock type definitions.
     */
    type Mocked<T extends object> = JestMocked<T>;
    /**
     * Wraps a class type with Jest mock type definitions.
     */
    type MockedClass<T extends ClassLike> = JestMockedClass<T>;
    /**
     * Wraps a function type with Jest mock type definitions.
     */
    type MockedFunction<T extends FunctionLike> = JestMockedFunction<T>;
    /**
     * Wraps an object type with Jest mock type definitions.
     */
    type MockedObject<T extends object> = JestMockedObject<T>;

    type MockInstance<T, Y extends any[]> = JestMockInstance<(...args: Y) => T>;

    interface Mock<T = any, Y extends any[] = any>
      extends Function, // eslint-disable-line @typescript-eslint/ban-types
        MockInstance<T, Y> {
      new (...args: Y): T;
      (...args: Y): T;
    }

    interface CustomMatcherResult {
      pass: boolean;
      message: string | (() => string);
    }

    type SpyInstance<T, Y extends any[]> = JestSpyInstance<(...args: Y) => T>;

    // Extension point for jest matchers
    interface Expect {}

    // Extension point for jest matchers
    interface Matchers<R> {}
  }
}
