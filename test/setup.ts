import type { Jest } from '@jest/environment';
// Check for missing or pending http mocks
import './http-mock';
import type { Global } from '@jest/types';
import type { AsymmetricMatchers, BaseExpect, Matchers } from 'expect';
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
import type { SnapshotMatchers } from 'jest-snapshot';
import type { Plugin } from 'pretty-format';

jest.mock('../lib/modules/platform', () => ({
  platform: jest.createMockFromModule('../lib/modules/platform/github'),
  initPlatform: jest.fn(),
  getPlatformList: jest.fn(),
}));
jest.mock('../lib/logger');

declare type Inverse<Matchers> = {
  /**
   * Inverse next matcher. If you know how to test something, `.not` lets you test its opposite.
   */
  not: Matchers;
};

type PromiseMatchers<T = unknown> = {
  /**
   * Unwraps the reason of a rejected promise so any other matcher can be chained.
   * If the promise is fulfilled the assertion fails.
   */
  rejects: JestMatchers<Promise<void>, T> &
    Inverse<JestMatchers<Promise<void>, T>>;
  /**
   * Unwraps the value of a fulfilled promise so any other matcher can be chained.
   * If the promise is rejected the assertion fails.
   */
  resolves: JestMatchers<Promise<void>, T> &
    Inverse<JestMatchers<Promise<void>, T>>;
};

type JestExpect = {
  <T = unknown>(actual: T): JestMatchers<void, T> &
    Inverse<JestMatchers<void, T>> &
    PromiseMatchers<T>;
  addSnapshotSerializer: (arg: Plugin) => void;
} & BaseExpect &
  AsymmetricMatchers &
  Inverse<Omit<AsymmetricMatchers, 'any' | 'anything'>> &
  jest.Expect;

interface JestEach {
  // Exclusively arrays.
  <T extends any[] | [any]>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (...args: T) => any,
    timeout?: number
  ) => void;
  <T extends [any, ...any[]]>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (...args: T) => ReturnType<Global.TestFn>,
    timeout?: number
  ) => void;
  // Not arrays.
  <T>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (...args: T[]) => ReturnType<Global.TestFn>,
    timeout?: number
  ) => void;
  (cases: ReadonlyArray<ReadonlyArray<any>>): (
    name: string,
    fn: (...args: any[]) => ReturnType<Global.TestFn>,
    timeout?: number
  ) => void;
  (strings: TemplateStringsArray, ...placeholders: any[]): (
    name: string,
    fn: (arg: any) => ReturnType<Global.TestFn>,
    timeout?: number
  ) => void;
}

type JestIt = Omit<Global.It, 'each'> & {
  /**
   * Creates a test closure.
   *
   * @param name The name of your test
   * @param fn The function for your test
   * @param timeout The timeout for an async function test
   */
  (name: Global.TestNameLike, fn?: Global.TestFn, timeout?: number): void;
  each: JestEach;
};

declare global {
  const afterAll: Global.HookBase;
  const afterEach: Global.HookBase;
  const beforeAll: Global.HookBase;
  const beforeEach: Global.HookBase;
  const describe: Global.Describe;
  const it: JestIt & Omit<Global.It, 'each'>;
  const jest: Omit<Jest, 'fn'> & {
    fn(): jest.Mock;
    fn<T, Y extends any[]>(implementation?: (...args: Y) => T): jest.Mock<T, Y>;
  };
  const test: JestIt;

  const expect: JestExpect;

  // eslint-disable-next-line @typescript-eslint/no-namespace
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
      extends Function,
        MockInstance<T, Y> {
      new (...args: Y): T;
      (...args: Y): T;
    }

    interface CustomMatcherResult {
      pass: boolean;
      message: string | (() => string);
    }

    type SpyInstance<T, Y extends any[]> = JestSpyInstance<(...args: Y) => T>;

    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Expect {}
  }

  type JestMatchers<R, T = any> = jest.Matchers<R> &
    SnapshotMatchers<R extends void | Promise<void> ? R : void, T> &
    Omit<
      Matchers<R extends void | Promise<void> ? R : void>,
      'toMatchObject'
    > & {
      toMatchObject<E extends object | any[]>(
        expected: E
      ): R extends void | Promise<void> ? R : void;
    };
}
