jest.mock('../../../lib/platform/bitbucket/bb-got-wrapper');

const got = require('../../../lib/platform/bitbucket/bb-got-wrapper');
const utils = require('../../../lib/platform/bitbucket/utils');

const range = count => [...Array(count).keys()];

describe('accumulateValues()', () => {
  it('paginates', async () => {
    got.get.mockReturnValueOnce({
      body: {
        values: range(10),
        next:
          'https://api.bitbucket.org/2.0/repositories/?pagelen=10&after=9&role=contributor',
      },
    });
    got.get.mockReturnValueOnce({
      body: {
        values: range(10),
        next:
          'https://api.bitbucket.org/2.0/repositories/?pagelen=10&after=19&role=contributor',
      },
    });
    got.get.mockReturnValueOnce({
      body: {
        values: range(5),
      },
    });
    const res = await utils.accumulateValues('some-url', 'get', null, 10);
    expect(res).toHaveLength(25);
    expect(got.get.mock.calls).toHaveLength(3);
  });
});
