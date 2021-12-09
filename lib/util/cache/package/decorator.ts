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
    /* TODO: Can descriptor be undefined ? */
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
type BooleanFunction<T extends any[] = any[]> = (...args: T) => boolean;

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
   * A function that returns true if a result is cacheable
   * Used to prevent caching of private, sensitive, results
   */
  cacheable?: BooleanFunction;

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
  cacheable = () => true,
  ttlMinutes = 30,
}: CacheParameters): Decorator<T> {
  return decorate(async ({ args, instance, callback }) => {
    if (!cacheable.apply(instance, args)) {
      return callback();
    }

    let finalNamespace: string | undefined;
    if (is.string(namespace)) {
      finalNamespace = namespace;
    } else if (is.function_(namespace)) {
      finalNamespace = namespace.apply(instance, args);
    }

    let finalKey: string | undefined;
    if (is.string(key)) {
      finalKey = key;
    } else if (is.function_(key)) {
      finalKey = key.apply(instance, args);
    }

    // istanbul ignore if
    if (!finalNamespace || !finalKey) {
      return callback();
    }

    const cachedResult = await packageCache.get<unknown>(
      finalNamespace,
      finalKey
    );

    if (cachedResult !== undefined) {
      return cachedResult;
    }

    const result = await callback();

    // only cache if we got a valid result
    if (result !== undefined) {
      await packageCache.set(finalNamespace, finalKey, result, ttlMinutes);
    }
    return result;
  });
}
