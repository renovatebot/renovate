import { DateTime } from 'luxon';

/**
 * Type that could be reliably cached, including `null` values.
 */
type NotUndefined<T> = T extends undefined ? never : T;

/**
 * Type used for partially initialized `Cacheable` values.
 */
type MaybeUndefined<T> = NotUndefined<T> | undefined;

/**
 * Default cache TTL.
 */
const defaultTtlMinutes = 15;

export class Cacheable<T> {
  private constructor(
    private _ttlMinutes: number,
    private _cachedAt: DateTime<true>,
    private _isPrivate: boolean,
    private _value: T,
  ) {}

  /**
   * Constructs an empty instance for further modification.
   */
  public static empty<T>(): Cacheable<MaybeUndefined<T>> {
    return new Cacheable<MaybeUndefined<T>>(
      defaultTtlMinutes,
      DateTime.now(),
      true,
      undefined,
    );
  }

  /**
   * Returns the TTL in minutes.
   */
  get ttlMinutes(): number {
    return this._ttlMinutes;
  }

  /**
   * Set the TTL in minutes.
   */
  set ttlMinutes(minutes: number) {
    this._ttlMinutes = minutes;
  }

  /**
   * Set the TTL in hours.
   */
  set ttlHours(hours: number) {
    this._ttlMinutes = 60 * hours;
  }

  /**
   * Set the TTL in days.
   */
  set ttlDays(hours: number) {
    this._ttlMinutes = 24 * 60 * hours;
  }

  /**
   * Sets the cache TTL in minutes and returns the same object.
   */
  public forMinutes(minutes: number): Cacheable<T> {
    this.ttlMinutes = minutes;
    return this;
  }

  /**
   * Construct the empty `Cacheable` instance with pre-configured minutes of TTL.
   */
  public static forMinutes<T>(minutes: number): Cacheable<MaybeUndefined<T>> {
    return Cacheable.empty<MaybeUndefined<T>>().forMinutes(minutes);
  }

  /**
   * Sets the cache TTL in hours and returns the same object.
   */
  public forHours(hours: number): Cacheable<T> {
    return this.forMinutes(60 * hours);
  }

  /**
   * Construct the empty `Cacheable` instance with pre-configured hours of TTL.
   */
  public static forHours<T>(hours: number): Cacheable<MaybeUndefined<T>> {
    return Cacheable.empty<MaybeUndefined<T>>().forHours(hours);
  }

  /**
   * Sets the cache TTL in days and returns the same object.
   */
  public forDays(days: number): Cacheable<T> {
    return this.forHours(24 * days);
  }

  /**
   * Construct the empty `Cacheable` instance with pre-configured hours of TTL.
   */
  public static forDays<T>(days: number): Cacheable<MaybeUndefined<T>> {
    return Cacheable.empty<MaybeUndefined<T>>().forDays(days);
  }

  /**
   * Construct `Cacheable` instance that SHOULD be persisted and available publicly.
   *
   * @param value Data to cache
   * @returns New `Cacheable` instance with the `value` guaranteed to be defined.
   */
  public static fromPublic<T>(
    value: NotUndefined<T>,
  ): Cacheable<NotUndefined<T>> {
    return new Cacheable<NotUndefined<T>>(
      defaultTtlMinutes,
      DateTime.now(),
      false,
      value,
    );
  }

  /**
   * Mark the partially initialized `Cacheable` instance as public,
   * for data that SHOULD be persisted and available publicly.
   *
   * @param value Data to cache
   * @returns New `Cacheable` instance with `value` guaranteed to be defined.
   */
  public asPublic<T>(value: NotUndefined<T>): Cacheable<NotUndefined<T>> {
    return new Cacheable<NotUndefined<T>>(
      this._ttlMinutes,
      this._cachedAt,
      false,
      value,
    );
  }

  /**
   * Construct `Cacheable` instance that MUST NOT be available publicly,
   * but still COULD be persisted in self-hosted setups.
   *
   * @param value Data to cache
   * @returns New `Cacheable` instance with `value` guaranteed to be defined.
   */
  public static fromPrivate<T>(
    value: NotUndefined<T>,
  ): Cacheable<NotUndefined<T>> {
    return new Cacheable<NotUndefined<T>>(
      defaultTtlMinutes,
      DateTime.now(),
      true,
      value,
    );
  }

  /**
   * Mark the partially initialized `Cacheable` instance as private,
   * for data that MUST NOT be available publicly,
   * but still COULD be persisted in self-hosted setups.
   *
   * @param value Data to cache
   * @returns New `Cacheable` instance with `value` guaranteed to be defined.
   */
  public asPrivate<T>(value: NotUndefined<T>): Cacheable<NotUndefined<T>> {
    return new Cacheable<NotUndefined<T>>(
      this._ttlMinutes,
      this._cachedAt,
      true,
      value,
    );
  }

  /**
   * Check whether the instance is private.
   */
  get isPrivate(): boolean {
    return this._isPrivate;
  }

  /**
   * Check whether the instance is public.
   */
  get isPublic(): boolean {
    return !this._isPrivate;
  }

  /**
   * Cached value
   */
  get value(): T {
    return this._value;
  }

  /**
   * The creation date of the cached value,
   * which is set during `fromPrivate`, `asPrivate`,
   * `fromPublic`, or `asPublic` calls.
   */
  get cachedAt(): string {
    return this._cachedAt.toUTC().toISO();
  }
}
