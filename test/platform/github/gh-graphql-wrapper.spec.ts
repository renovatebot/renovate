import { getGraphqlNodes } from '../../../lib/platform/github/gh-graphql-wrapper';

/** @type any */
const get = require('../../../lib/platform/github/gh-got-wrapper').default;

jest.mock('../../../lib/platform/github/gh-got-wrapper');

const query = `
      query {
        repository(owner: "testOwner", name: "testName") {
          testItem (orderBy: {field: UPDATED_AT, direction: DESC}, filterBy: {createdBy: "someone"}) {
            pageInfo {
              startCursor
              hasNextPage
            }
            nodes {
              number state title body
            }
          }
        }
      }`;

describe('platform/gh-graphql-wrapper', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns empty array for undefined data', async () => {
    get.post.mockReturnValue({
      body: JSON.stringify({
        someprop: 'someval',
      }),
    });
    expect(await getGraphqlNodes(query, 'testItem')).toEqual([]);
  });
  it('returns empty array for undefined data.', async () => {
    get.post.mockReturnValue({
      body: JSON.stringify({
        data: { repository: { otherField: 'someval' } },
      }),
    });
    expect(await getGraphqlNodes(query, 'testItem')).toEqual([]);
  });
  it('throws platform-error for invalid response', async () => {
    get.post.mockReturnValue({
      body: 'invalid json',
    });

    await expect(getGraphqlNodes(query, 'testItem')).rejects.toThrow(
      'platform-error'
    );
  });
  it('halves node count and retries request', async () => {
    get.post.mockReturnValue({
      body: JSON.stringify({
        someprop: 'someval',
      }),
    });

    await getGraphqlNodes(query, 'testItem');
    expect(get.post).toHaveBeenCalledTimes(7);
  });
  it('retrieves all data from all pages', async () => {
    get.post.mockReturnValueOnce({
      body: JSON.stringify({
        data: {
          repository: {
            testItem: {
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
            testItem: {
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
            testItem: {
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

    const items = await getGraphqlNodes(query, 'testItem');
    expect(get.post).toHaveBeenCalledTimes(3);
    expect(items.length).toEqual(3);
  });
});
