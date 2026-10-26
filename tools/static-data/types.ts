/**
 * A source of static data, which is written to a single JSON file.
 */
export interface StaticDataSource<Raw, Data> {
  /** The name of the source, which can be passed to `pnpm update-static-data` */
  name: string;
  /** The path to the JSON file that the data is written to */
  file: string;
  /** Fetches the raw data from upstream */
  fetch(): Promise<Raw>;
  /** Converts the raw data into the contents of `file`, without side effects */
  generate(raw: Raw): Data;
}
