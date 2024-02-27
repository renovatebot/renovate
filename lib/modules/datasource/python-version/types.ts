export interface PythonRelease {
  /** e.g: "Python 3.9.0b1" */
  name: string;

  /** e.g: "python-390b1" */
  slug: string;

  /** Major version e.g: 3 */
  version: number;

  /** */
  is_published: boolean;

  /** is latest major version, true for Python 2.7.18 and latest Python 3 */
  is_latest: boolean;

  /** ISO 8601 */
  release_date: string;

  /** */
  pre_release: boolean;

  /** */
  release_page: string;

  /** Changelog e.g: "https://docs.python.org/…html#python-3-9-0-beta-1" */
  release_notes_url: string;

  /** If shown on python.org */
  show_on_download_page: boolean;

  /** Download URL e.g: "https://www.python.org/api/v2/downloads/release/436/" */
  resource_uri: string;
}
