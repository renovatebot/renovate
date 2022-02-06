// https://stackoverflow.com/a/58110124

type Truthy<T> = T extends false | '' | 0 | null | undefined ? never : T;

export function truthy<T>(value: T): value is Truthy<T> {
  return !!value;
}
