import { DateTime } from 'luxon';

type NotUndefined<T> = T extends undefined ? never : T;
type MaybeUndefined<T> = NotUndefined<T> | undefined;

const defaultTtlMinutes = 15;

export class Cacheable<T> {
  private constructor(
    private _ttlMinutes: number,
    private _cachedAt: DateTime<true>,
    private _isPrivate: boolean,
    private _value: T,
  ) {}

  public static empty<T>(): Cacheable<MaybeUndefined<T>> {
    return new Cacheable<MaybeUndefined<T>>(
      defaultTtlMinutes,
      DateTime.now(),
      true,
      undefined,
    );
  }

  get ttlMinutes(): number {
    return this._ttlMinutes;
  }

  set ttlMinutes(minutes: number) {
    this._ttlMinutes = minutes;
  }

  set ttlHours(hours: number) {
    this._ttlMinutes = 60 * hours;
  }

  set ttlDays(hours: number) {
    this._ttlMinutes = 24 * 60 * hours;
  }

  public forMinutes(minutes: number): Cacheable<T> {
    return new Cacheable<T>(
      minutes,
      this._cachedAt,
      this._isPrivate,
      this._value,
    );
  }

  public static forMinutes<T>(minutes: number): Cacheable<MaybeUndefined<T>> {
    return Cacheable.empty<MaybeUndefined<T>>().forMinutes(minutes);
  }

  public forHours(hours: number): Cacheable<T> {
    return this.forMinutes(60 * hours);
  }

  public static forHours<T>(hours: number): Cacheable<MaybeUndefined<T>> {
    return Cacheable.empty<MaybeUndefined<T>>().forHours(hours);
  }

  public forDays(days: number): Cacheable<T> {
    return this.forHours(24 * days);
  }

  public static forDays<T>(days: number): Cacheable<MaybeUndefined<T>> {
    return Cacheable.empty<MaybeUndefined<T>>().forDays(days);
  }

  public static asPublic<T>(
    value: NotUndefined<T>,
  ): Cacheable<NotUndefined<T>> {
    return new Cacheable<NotUndefined<T>>(
      defaultTtlMinutes,
      DateTime.now(),
      false,
      value,
    );
  }

  public asPublic<T>(value: NotUndefined<T>): Cacheable<NotUndefined<T>> {
    return new Cacheable<NotUndefined<T>>(
      this._ttlMinutes,
      this._cachedAt,
      false,
      value,
    );
  }

  public static asPrivate<T>(
    value: NotUndefined<T>,
  ): Cacheable<NotUndefined<T>> {
    return new Cacheable<NotUndefined<T>>(
      defaultTtlMinutes,
      DateTime.now(),
      true,
      value,
    );
  }

  public asPrivate<T>(value: NotUndefined<T>): Cacheable<NotUndefined<T>> {
    return new Cacheable<NotUndefined<T>>(
      this._ttlMinutes,
      this._cachedAt,
      true,
      value,
    );
  }

  get isPrivate(): boolean {
    return this._isPrivate;
  }

  get isPublic(): boolean {
    return !this._isPrivate;
  }

  get value(): T {
    return this._value;
  }

  get cachedAt(): string {
    return this._cachedAt.toUTC().toISO();
  }
}
