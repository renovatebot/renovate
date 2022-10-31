import { adapter } from './releases-adapter';
import type { GithubGraphqlRelease } from './types';

const item: GithubGraphqlRelease = {
  version: '1.2.3',
  releaseTimestamp: '2024-09-24',
  isDraft: false,
  isPrerelease: false,
  url: 'https://example.com',
  id: 123,
  name: 'name',
  description: 'description',
};

describe('util/github/graphql/releases-adapter', () => {
  it('transforms items', () => {
    expect(adapter.transform(item)).toEqual({
      description: 'description',
      id: 123,
      name: 'name',
      releaseTimestamp: '2024-09-24',
      url: 'https://example.com',
      version: '1.2.3',
    });
  });

  it('filters out drafts', () => {
    expect(adapter.transform({ ...item, isDraft: true })).toBeNull();
  });

  it('marks prereleases as unstable', () => {
    expect(adapter.transform({ ...item, isPrerelease: true })).toMatchObject({
      isStable: false,
    });
  });
});
