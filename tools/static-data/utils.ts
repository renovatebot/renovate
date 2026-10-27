import { safeStringify } from '../../lib/util/stringify.ts';
import type { CommitMessage } from './types.ts';

/**
 * Fetches the given URL, throwing if the response is not successful.
 */
export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

/**
 * Describes the keys which were added, removed or changed between `before`
 * and `after`, using `subject` to create the commit subject from the added
 * keys.
 */
export function describeKeys(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  subject: (added: string[]) => string,
): CommitMessage {
  const added = Object.keys(after).filter((k) => !(k in before));
  const removed = Object.keys(before).filter((k) => !(k in after));
  const changed = Object.keys(after).filter(
    (k) => k in before && safeStringify(before[k]) !== safeStringify(after[k]),
  );

  const sections: [string, string[]][] = [
    ['Added', added],
    ['Removed', removed],
    ['Changed', changed],
  ];
  const body = sections
    .filter(([, keys]) => keys.length > 0)
    .map(
      ([heading, keys]) =>
        `${heading}:\n\n${keys.map((k) => `- \`${k}\``).join('\n')}`,
    )
    .join('\n\n');

  return { subject: subject(added), body };
}
