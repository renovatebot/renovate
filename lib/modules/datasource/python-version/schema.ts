import { z } from 'zod';
import { MaybeTimestamp } from '../../../util/timestamp';
import type { Release } from '../types';

export const PythonRelease = z
  .object({
    /** e.g: "Python 3.9.0b1" */
    name: z.string(),
    /** e.g: "python-390b1" */
    slug: z.string(),
    /** Major version e.g: 3 */
    version: z.number(),
    /** is latest major version, true for Python 2.7.18 and latest Python 3 */
    is_latest: z.boolean(),
    is_published: z.boolean(),
    release_date: MaybeTimestamp,
    pre_release: z.boolean(),
    release_page: z.string().nullable(),
    show_on_download_page: z.boolean(),
    /** Changelog e.g: "https://docs.python.org/…html#python-3-9-0-beta-1" */
    release_notes_url: z.string(),
    /** Download URL e.g: "https://www.python.org/api/v2/downloads/release/436/" */
    resource_uri: z.string(),
  })
  .transform(
    ({ name, release_date: releaseTimestamp, pre_release }): Release => {
      const version = name?.replace('Python', '').trim();
      const isStable = pre_release === false;
      return { version, releaseTimestamp, isStable };
    },
  )
  .array();
