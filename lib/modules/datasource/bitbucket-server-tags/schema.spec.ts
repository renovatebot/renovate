import { BitbucketServerCommits, BitbucketServerTags } from './schema';

describe('modules/datasource/bitbucket-server-tags/schema', () => {
  it('parses BitbucketServerTags', () => {
    const response = [
      {
        id: 'refs/tags/v17.7.2-deno',
        displayId: 'v17.7.2-deno',
        type: 'TAG',
        latestCommit: 'e1760e45c78538f2fd59d4a09fc0c0c6fd4b2379',
        latestChangeset: 'e1760e45c78538f2fd59d4a09fc0c0c6fd4b2379',
        hash: '430f18aa2968b244fc91ecd9f374f62301af4b63',
      },
      {
        id: 'refs/tags/v17.7.2',
        displayId: 'v17.7.2',
        type: 'TAG',
        latestCommit: '3566b84b24a7e8cf24badac73ea1d20a0851924e',
        latestChangeset: '3566b84b24a7e8cf24badac73ea1d20a0851924e',
        hash: null,
      },
    ];
    expect(BitbucketServerTags.parse(response)).toMatchObject([
      {
        displayId: 'v17.7.2-deno',
        hash: '430f18aa2968b244fc91ecd9f374f62301af4b63',
      },
      { displayId: 'v17.7.2', hash: null },
    ]);
  });

  it('parses BitbucketServerCommits', () => {
    const response = [
      {
        id: '0c95f9c79e1810cf9c8964fbf7d139009412f7e7',
        displayId: '0c95f9c79e1',
      },
      {
        id: '4266485b20e9b0f3a7f196e84c6d8284b04642cd',
        displayId: '4266485b20e',
      },
    ];
    expect(BitbucketServerCommits.parse(response)).toMatchObject([
      { id: '0c95f9c79e1810cf9c8964fbf7d139009412f7e7' },
      { id: '4266485b20e9b0f3a7f196e84c6d8284b04642cd' },
    ]);
  });
});
