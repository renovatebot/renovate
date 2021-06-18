import is from '@sindresorhus/is';
import * as packageCache from '.';

type Handler<T> = (parameters: DecoratorParameters<T>) => Promise<unknown>;
type Method<T> = (this: T, ...args: any[]) => Promise<any>;
type Decorator<T> = <U extends T>(
  target: U,
  key: keyof U,
  descriptor: TypedPropertyDescriptor<Method<T>>
) => TypedPropertyDescriptor<Method<T>>;

interface DecoratorParameters<T, U extends any[] = any[]> {
  /**
   * Current call arguments.
   */
  args: U;

  /**
   * A callback to call the decorated method with the current arguments.
   */
  callback(): unknown;

  /**
   * Current call context.
   */
  instance: T;
}

/**
 * Applies decorating function to intercept decorated method calls.
 * @param fn - The decorating function.
 */
function decorate<T>(fn: Handler<T>): Decorator<T> {
  const result: Decorator<T> = (
    target,
    key,
    descriptor = Object.getOwnPropertyDescriptor(target, key) ?? {
      enumerable: true,
      configurable: true,
      writable: true,
    }
  ) => {
    const { value } = descriptor;

    return Object.assign(descriptor, {
      value(this: T, ...args: any[]) {
        return fn({
          args,
          instance: this,
          callback: () => value?.apply(this, args),
        });
      },
    });
  };

  return result;
}

type HashFunction<T extends any[] = any[]> = (...args: T) => string;

/**
 * The cache decorator parameters.
 */
interface CacheParameters {
  /**
   * The cache namespace
   * Either a string or a hash function that generates a string
   */
  namespace: string | HashFunction;

  /**
   * The cache key
   * Either a string or a hash function that generates a string
   */
  key: string | HashFunction;

  /**
   * The TTL (or expiry) of the key in minutes
   */
  ttlMinutes?: number;
}

/**
 * caches the result of a decorated method.
 */
export function cache<T>({
  namespace,
  key,
  ttlMinutes = 30,
}: CacheParameters): Decorator<T> {
  return decorate(async ({ args, instance, callback }) => {
    let finalNamespace: string;
    if (is.string(namespace)) {
      finalNamespace = namespace;
    } else if (is.function_(namespace)) {
      finalNamespace = namespace.apply(instance, args);
    }

    let finalKey: string;
    if (is.string(key)) {
      finalKey = key;
    } else if (is.function_(key)) {
      finalKey = key.apply(instance, args);
    }

    const cachedResult = await packageCache.get<unknown>(
      finalNamespace,
      finalKey
    );

    if (cachedResult !== undefined) {
      return cachedResult;
    }

    const result = await callback();

    await packageCache.set(finalNamespace, finalKey, result, ttlMinutes);
    return result;
  });
}
