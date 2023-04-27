export class StarlarkBoolean {
  static readonly stringMapping: ReadonlyMap<string, boolean> = new Map<
    string,
    boolean
  >([
    ['True', true],
    ['False', false],
  ]);

  static readonly stringValues = Array.from(
    StarlarkBoolean.stringMapping.keys()
  );

  static asBoolean(value: string): boolean {
    const result = StarlarkBoolean.stringMapping.get(value);
    if (result !== undefined) {
      return result;
    }
    throw new Error(`Invalid Starlark boolean string: ${value}`);
  }
}
