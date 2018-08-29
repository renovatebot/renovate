const fs = require('fs');
const got = require('got');
const datasource = require('../../lib/datasource');

jest.mock('got');

const res1 = fs.readFileSync('test/_fixtures/pypi/azure-cli-monitor.json');

describe('datasource/pypi', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce({});
      expect(await datasource.getPkgReleases('pkg:pypi/something')).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await datasource.getPkgReleases('pkg:pypi/something')).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(res1),
      });
      expect(
        await datasource.getPkgReleases('pkg:pypi/azure-cli-monitor')
      ).toMatchSnapshot();
    });
    it('supports custom datasource url', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(res1),
      });
      const config = {
        registryUrls: ['https://custom.pypi.net/foo'],
      };
      await datasource.getPkgReleases('pkg:pypi/azure-cli-monitor', config);
      expect(got.mock.calls).toMatchSnapshot();
    });
    it('supports custom datasource url from environmental variable', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(res1),
      });
      const pipIndexUrl = process.env.PIP_INDEX_URL;
      process.env.PIP_INDEX_URL = 'https://my.pypi.python/pypi/';
      await datasource.getPkgReleases('pkg:pypi/azure-cli-monitor');
      expect(got.mock.calls).toMatchSnapshot();
      process.env.PIP_INDEX_URL = pipIndexUrl;
    });
    it('returns non-github home_page', async () => {
      got.mockReturnValueOnce({
        body: {
          info: {
            name: 'something',
            home_page: 'https://microsoft.com',
          },
        },
      });
      expect(
        await datasource.getPkgReleases('pkg:pypi/something')
      ).toMatchSnapshot();
    });
    it('returns null if mismatched name', async () => {
      got.mockReturnValueOnce({
        body: {
          info: {
            name: 'something-else',
            home_page: 'https://microsoft.com',
          },
        },
      });
      expect(await datasource.getPkgReleases('pkg:pypi/something')).toBeNull();
    });
  });
});
