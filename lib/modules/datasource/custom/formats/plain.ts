import { readLocalFile } from '../../../../util/fs';
import type { Http } from '../../../../util/http';
import { newlineRegex } from '../../../../util/regex';
import type { ReleaseResult } from '../../types';

function convertLinesToVersions(content: string): ReleaseResult {
  const lines = content.split(newlineRegex).map((line) => line.trim());

  const versions = lines.map((value) => {
    return { version: value };
  });

  return {
    releases: versions,
  };
}

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

export async function read(path: string): Promise<ReleaseResult | null> {
  const fileContent = await readLocalFile(path, 'utf8');

  return fileContent ? convertLinesToVersions(fileContent) : null;
}
