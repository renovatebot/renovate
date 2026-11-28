type Groups = Record<string, string | string[]>;

export interface MonorepoData {
  repoGroups?: Groups;
  orgGroups?: Groups;
}

const groupTypes = ['repoGroups', 'orgGroups'] as const;

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Finds source URLs that were present in `base` but are missing from `head`.
 *
 * Old URLs must be kept (by turning the value into an array), as older releases of a package may still point at the previous repository.
 */
export function findRemovedUrls(
  base: MonorepoData,
  head: MonorepoData,
): string[] {
  const removed: string[] = [];
  for (const groupType of groupTypes) {
    const baseGroups = base[groupType] ?? {};
    const headGroups = head[groupType] ?? {};
    for (const [name, value] of Object.entries(baseGroups)) {
      if (!(name in headGroups)) {
        // deleting a whole preset is a separate decision
        continue;
      }
      const headUrls = toArray(headGroups[name]);
      for (const url of toArray(value)) {
        if (!headUrls.includes(url)) {
          removed.push(`${groupType}.${name}: ${url}`);
        }
      }
    }
  }
  return removed;
}
