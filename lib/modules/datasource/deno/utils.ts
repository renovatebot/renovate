import { getSourceUrl as getGithubSourceUrl } from '../../../util/github/url';
import type { DenoAPITags, DenoAPIUploadOptions } from './types';

export function createSourceURL({
  type,
  repository,
}: DenoAPIUploadOptions): string | undefined {
  switch (type) {
    case 'github':
      return getGithubSourceUrl(repository);
    default:
      return undefined;
  }
}

export function tagsToRecord(tags: DenoAPITags[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const { kind, value } of tags) {
    record[kind] = value;
  }
  return record;
}
