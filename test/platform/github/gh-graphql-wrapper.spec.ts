import get from '../../../lib/platform/github/gh-got-wrapper';
import Graphql from '../../../lib/platform/github/gh-graphql-wrapper';

jest.mock('../../../lib/platform/github/gh-got-wrapper');

describe('platform/gh-graphql-wrapper', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('sets repo owner', () => {
    const gql = new Graphql();
    const repoOwner = 'testRepoOwner';
    gql.setRepoOwner(repoOwner);

    expect(gql.repoOwner).toEqual(repoOwner);
  });
  it('sets repo name', () => {
    const gql = new Graphql();
    const repoName = 'testRepoName';
    gql.setRepoName(repoName);

    expect(gql.repoName).toEqual(repoName);
  });
  it('sets repo item', () => {
    const gql = new Graphql();
    const repoItem = 'testRepoItem';
    gql.setRepoItem(repoItem);

    expect(gql.repoItem).toEqual(repoItem);
  });
  it('sets repo item filterBy', () => {
    const gql = new Graphql();
    const repoItemFilterBy = 'testRepoItemFilterBy';
    gql.setRepoItemFilterBy(repoItemFilterBy);

    expect(gql.repoItemFilterBy).toEqual(repoItemFilterBy);
  });
  it('sets repo item node list', () => {
    const gql = new Graphql();
    const repoItemNodeList = ['number', 'state', 'title', 'body'];
    gql.setRepoItemNodeList(repoItemNodeList);

    expect(gql.repoItemNodeList).toEqual(repoItemNodeList);
  });
  it('sets repo result num els', () => {
    const gql = new Graphql();
    const repoResultNumEls = 50;
    gql.setRepoResultNumEls(repoResultNumEls);

    expect(gql.repoResultNumEls).toEqual(repoResultNumEls);
  });
  it('fails when no data in response', async () => {
    const gql = new Graphql();
    gql.setRepoOwner('testOwner');
    gql.setRepoName('testName');
    gql.setRepoItem('testItem');
    gql.setRepoItemFilterBy(`{createdBy: "someone"}`);
    gql.setRepoItemNodeList(['number', 'state', 'title', 'body']);
    gql.setRepoResultNumEls(1);

    get.post.mockReturnValue({
      body: JSON.stringify({
        someprop: 'someval',
      }),
    });

    const [
      success,
      items,
      cursor,
    ] = await gql.get(); /* eslint-disable-line @typescript-eslint/no-unused-vars */
    expect(success).toStrictEqual(false);
  });
  it('fails when invalid json in response', async () => {
    const gql = new Graphql();
    gql.setRepoOwner('testOwner');
    gql.setRepoName('testName');
    gql.setRepoItem('testItem');
    gql.setRepoItemFilterBy(`{createdBy: "someone"}`);
    gql.setRepoItemNodeList(['number', 'state', 'title', 'body']);
    gql.setRepoResultNumEls(1);

    get.post.mockReturnValue({
      body: 'some not json content',
    });

    const [
      success,
      items,
      cursor,
    ] = await gql.get(); /* eslint-disable-line @typescript-eslint/no-unused-vars */
    expect(success).toStrictEqual(false);
  });
  it('retries with half repoResultNumEls when no data in response', async () => {
    const gql = new Graphql();
    gql.setRepoOwner('testOwner');
    gql.setRepoName('testName');
    gql.setRepoItem('testItem');
    gql.setRepoItemFilterBy(`{createdBy: "someone"}`);
    gql.setRepoItemNodeList(['number', 'state', 'title', 'body']);
    gql.setRepoResultNumEls(100);
    // should fire 7 requests(6 retries) | 100, 50, 25, 12, 6, 3, 1

    get.post.mockReturnValue({
      body: JSON.stringify({
        someprop: 'someval',
      }),
    });

    await gql.get();
    expect(get.post).toHaveBeenCalledTimes(7);
  });
  it('returns cursor if hasNextPage', async () => {
    const gql = new Graphql();
    gql.setRepoOwner('testOwner');
    gql.setRepoName('testName');
    gql.setRepoItem('issues');
    gql.setRepoItemFilterBy(`{createdBy: "someone"}`);
    gql.setRepoItemNodeList(['number', 'state', 'title', 'body']);

    const expectedCursor =
      'Y3Vyc29yOnYyOpK5MjAxOS0wNS0yOVQwMjoxMTozMSswMzowMM4auIKQ';
    get.post.mockReturnValue({
      body: JSON.stringify({
        data: {
          repository: {
            issues: {
              pageInfo: {
                startCursor: expectedCursor,
                hasNextPage: true,
              },
              nodes: [
                {
                  number: 1,
                  state: 'OPEN',
                  title: 'title-1',
                  body: 'the body 1',
                },
                {
                  number: 2,
                  state: 'CLOSED',
                  title: 'title-2',
                  body: 'the body 2',
                },
                {
                  number: 3,
                  state: 'OPEN',
                  title: 'title-3',
                  body: 'the body 3',
                },
              ],
            },
          },
        },
      }),
    });

    const [
      success,
      items,
      cursor,
    ] = await gql.get(); /* eslint-disable-line @typescript-eslint/no-unused-vars */
    expect(cursor).toStrictEqual(expectedCursor);
  });
  it("doesn't return cursor if not hasNextPage", async () => {
    const gql = new Graphql();
    gql.setRepoOwner('testOwner');
    gql.setRepoName('testName');
    gql.setRepoItem('issues');
    gql.setRepoItemFilterBy(`{createdBy: "someone"}`);
    gql.setRepoItemNodeList(['number', 'state', 'title', 'body']);

    const expectedCursor =
      'Y3Vyc29yOnYyOpK5MjAxOS0wNS0yOVQwMjoxMTozMSswMzowMM4auIKQ';
    get.post.mockReturnValue({
      body: JSON.stringify({
        data: {
          repository: {
            issues: {
              pageInfo: {
                startCursor: expectedCursor,
                hasNextPage: false,
              },
              nodes: [
                {
                  number: 1,
                  state: 'OPEN',
                  title: 'title-1',
                  body: 'the body 1',
                },
                {
                  number: 2,
                  state: 'CLOSED',
                  title: 'title-2',
                  body: 'the body 2',
                },
                {
                  number: 3,
                  state: 'OPEN',
                  title: 'title-3',
                  body: 'the body 3',
                },
              ],
            },
          },
        },
      }),
    });

    const [
      success,
      items,
      cursor,
    ] = await gql.get(); /* eslint-disable-line @typescript-eslint/no-unused-vars */
    expect(cursor).toStrictEqual('');
  });
  it('gets all by following paging', async () => {
    const gql = new Graphql();
    gql.setRepoOwner('testOwner');
    gql.setRepoName('testName');
    gql.setRepoItem('issues');
    gql.setRepoItemFilterBy(`{createdBy: "someone"}`);
    gql.setRepoItemNodeList(['number', 'state', 'title', 'body']);
    gql.setRepoResultNumEls(1);

    get.post.mockReturnValueOnce({
      body: JSON.stringify({
        data: {
          repository: {
            issues: {
              pageInfo: {
                startCursor: 'cursor1',
                hasNextPage: true,
              },
              nodes: [
                {
                  number: 1,
                  state: 'OPEN',
                  title: 'title-1',
                  body: 'the body 1',
                },
              ],
            },
          },
        },
      }),
    });

    get.post.mockReturnValueOnce({
      body: JSON.stringify({
        data: {
          repository: {
            issues: {
              pageInfo: {
                startCursor: 'cursor2',
                hasNextPage: true,
              },
              nodes: [
                {
                  number: 2,
                  state: 'CLOSED',
                  title: 'title-2',
                  body: 'the body 2',
                },
              ],
            },
          },
        },
      }),
    });

    get.post.mockReturnValueOnce({
      body: JSON.stringify({
        data: {
          repository: {
            issues: {
              pageInfo: {
                startCursor: 'cursor3',
                hasNextPage: false,
              },
              nodes: [
                {
                  number: 3,
                  state: 'OPEN',
                  title: 'title-3',
                  body: 'the body 3',
                },
              ],
            },
          },
        },
      }),
    });

    const items = await gql.getAll();
    expect(get.post).toHaveBeenCalledTimes(3);
    expect(items.length).toEqual(3);
  });
});
