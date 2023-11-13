import fs from 'fs-extra';
import type { Http } from '../../../../util/http';
import { newlineRegex } from '../../../../util/regex';
import type { ReleaseResult } from '../../types';

const convertLinesToVersions = (content: string): ReleaseResult | null => {
  const lines = content.split(newlineRegex).map((line) => line.trim());

  const versions = lines.map((value) => {
    return { version: value };
  });

  return {
    releases: versions,
  };
};

export async function fetch(
  http: Http,
  url: string,
): Promise<ReleaseResult | null> {
  const response = await http.getPlain(url);

  const contentType = response.headers['content-type'];
  if (!contentType?.startsWith('text/')) {
    return null;
  }

  return convertLinesToVersions(response.body);
}

export async function read(path: string): Promise<unknown> {
  const fileContent = await fs.readFile(path, 'utf8');

  return convertLinesToVersions(fileContent);
}
