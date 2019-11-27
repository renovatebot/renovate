import { getGraphqlNodes } from '../../../lib/platform/github/gh-graphql-wrapper';

/** @type any */
const got = require('../../../lib/util/got').default;

jest.mock('../../../lib/util/got');

const query = `
      query {
        repository(owner: "testOwner", name: "testName") {
          testItem (orderBy: {field: UPDATED_AT, direction: DESC}, filterBy: {createdBy: "someone"}) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              number state title body
            }
          }
        }
      }`;

async function getError(q: string, f: string) {
  let error;
  try {
    await getGraphqlNodes(q, f);
  } catch (err) {
    error = err;
  }
  return error;
}

describe('platform/gh-graphql-wrapper', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete global.appMode;
  });
  it('supports app mode', async () => {
    global.appMode = true;
    await getGraphqlNodes(query, 'testItem');
    expect(got.mock.calls[0][1].headers.accept).toEqual(
      'application/vnd.github.machine-man-preview+json, application/vnd.github.merge-info-preview+json'
    );
  });
  it('returns empty array for undefined data', async () => {
    got.mockReturnValue({
      body: {
        data: {
          someprop: 'someval',
        },
      },
    });
    expect(await getGraphqlNodes(query, 'testItem')).toEqual([]);
  });
  it('returns empty array for undefined data.', async () => {
    got.mockReturnValue({
      body: {
        data: { repository: { otherField: 'someval' } },
      },
    });
    expect(await getGraphqlNodes(query, 'testItem')).toEqual([]);
  });
  it('throws errors for invalid responses', async () => {
    const gotErr = {
      statusCode: 418,
      message: 'Sorry, this is a teapot',
    };
    got.mockImplementationOnce(() => Promise.reject(gotErr));
    const e = await getError(query, 'someItem');
    expect(e).toBe(gotErr);
  });
  it('halves node count and retries request', async () => {
    got.mockReturnValue({
      body: {
        data: {
          someprop: 'someval',
        },
      },
    });

    await getGraphqlNodes(query, 'testItem');
    expect(got).toHaveBeenCalledTimes(7);
  });
  it('retrieves all data from all pages', async () => {
    got.mockReturnValueOnce({
      body: {
        data: {
          repository: {
            testItem: {
              pageInfo: {
                endCursor: 'cursor1',
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
      },
    });

    got.mockReturnValueOnce({
      body: {
        data: {
          repository: {
            testItem: {
              pageInfo: {
                endCursor: 'cursor2',
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
      },
    });

    got.mockReturnValueOnce({
      body: {
        data: {
          repository: {
            testItem: {
              pageInfo: {
                endCursor: 'cursor3',
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
      },
    });

    const items = await getGraphqlNodes(query, 'testItem');
    expect(got).toHaveBeenCalledTimes(3);
    expect(items.length).toEqual(3);
  });
});
