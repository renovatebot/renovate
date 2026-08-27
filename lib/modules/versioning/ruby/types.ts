export interface Range {
  version: string;
  operator: string;
  delimiter: string;
  /**
   * If the range is `~>` and immediately followed by `>=`,
   * the latter range is considered the former's companion
   * and assigned here instead of being an independent range.
   *
   * Example: `'~> 6.2', '>= 6.2.1'`
   */
  companion?: Range;
}
