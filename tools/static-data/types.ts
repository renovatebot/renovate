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
  /**
   * Describes the change from `before` to `after`, without side effects.
   * `before` is `undefined` if `file` did not previously exist.
   */
  commitMessage(before: Data | undefined, after: Data): CommitMessage;
}

export interface CommitMessage {
  /** The commit subject, without the `feat(static-data): ` prefix */
  subject: string;
  body?: string;
}
