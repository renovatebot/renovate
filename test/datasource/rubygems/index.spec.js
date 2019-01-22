const got = require('got');
const railsInfo = require('../../_fixtures/rubygems/rails/info.json');
const railsVersions = require('../../_fixtures/rubygems/rails/versions.json');
const rubygems = require('../../../lib/datasource/rubygems/index.js');

jest.mock('got');

describe('datasource/rubygems', () => {
  describe('getPkgReleases', () => {
    const SKIP_CACHE = process.env.RENOVATE_SKIP_CACHE;

    const pkg = { fullname: 'rails' };
    const registryUrls = ['https://thirdparty.com', 'https://firstparty.com'];
    const params = [pkg, { registryUrls }];

    beforeEach(() => {
      process.env.RENOVATE_SKIP_CACHE = true;
      jest.resetAllMocks();
    });

    it('returns null for missing pkg', async () => {
      got.mockReturnValueOnce({});
      expect(await rubygems.getPkgReleases(...params)).toBeNull();
    });

    it('works with real data', async () => {
      got
        .mockReturnValueOnce({ body: railsInfo })
        .mockReturnValueOnce({ body: railsVersions });

      expect(await rubygems.getPkgReleases(...params)).toMatchSnapshot();
    });

    it('uses multiple source urls', async () => {
      got
        .mockImplementationOnce(() =>
          Promise.reject({
            statusCode: 404,
          })
        )
        .mockImplementationOnce(() => ({ body: railsInfo }))
        .mockImplementationOnce(() => ({ body: railsVersions }));

      expect(await rubygems.getPkgReleases(...params)).toMatchSnapshot();
    });

    it('returns null if mismatched name', async () => {
      got.mockReturnValueOnce({ body: { ...railsInfo, name: 'oooops' } });
      expect(await rubygems.getPkgReleases(...params)).toBeNull();
    });

    afterEach(() => {
      global.repoCache = {};
      process.env.RENOVATE_SKIP_CACHE = SKIP_CACHE;
    });
  });
});
