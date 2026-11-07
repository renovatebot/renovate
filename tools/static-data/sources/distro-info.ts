import type { StaticDataSource } from '../types.ts';
import { describeKeys, fetchText } from '../utils.ts';

type DistroInfo = Record<string, Record<string, string | undefined>>;

/**
 * Converts a `distro-info-data` CSV into an object, keyed by the version.
 */
function csvToJson(raw: string): DistroInfo {
  const lines = raw.split(/\r?\n/);

  const res: DistroInfo = {};
  const headers = lines[0].split(',');

  // drop headers
  lines.shift();

  // drop "version" header
  headers.shift();

  for (const l of lines) {
    if (!l) {
      continue;
    }

    const obj: Record<string, string | undefined> = {};
    const line = l.split(',');
    let ver = line.shift()?.replace(/LTS|\s/g, '');

    for (const [i, h] of headers.entries()) {
      obj[h.replace('-', '_')] = line[i];
    }

    if (ver) {
      // Debian related, example codename "hamm" version is 2.0
      // change 2.0 -> 2
      ver = ver.endsWith('.0') ? ver.replace('.0', '') : ver;
      res[`v${ver}`] = obj;
    }
  }
  return res;
}

export function distroInfo(
  distro: 'ubuntu' | 'debian',
): StaticDataSource<string, DistroInfo> {
  return {
    name: `${distro}-distro-info`,
    file: `data/${distro}-distro-info.json`,
    fetch: () =>
      fetchText(
        `https://debian.pages.debian.net/distro-info-data/${distro}.csv`,
      ),
    generate: csvToJson,
    commitMessage: (before, after) => {
      const name = distro === 'ubuntu' ? 'Ubuntu' : 'Debian';
      return describeKeys(before ?? {}, after, (added) =>
        added.length > 0
          ? `add ${added.map((v) => `${name} ${v}`).join(', ')}`
          : `update ${name} distro info`,
      );
    },
  };
}
