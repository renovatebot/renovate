import { regEx } from '../../../util/regex.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import type { Release } from '../types.ts';

const entryRegex = regEx(
  /<a href="(?<version>\d+\.\d+(?:\.\d+)?)\/">[^<]+<\/a>\s+(?<date>\d{2}-\w{3}-\d{4} \d{2}:\d{2})/g,
);

export function parseFtpListing(html: string): Release[] {
  const releases: Release[] = [];

  for (const match of html.matchAll(entryRegex)) {
    const { version, date } = match.groups!;
    const releaseTimestamp = asTimestamp(date);

    releases.push({
      version,
      releaseTimestamp,
      isStable: true,
    });
  }

  return releases;
}
