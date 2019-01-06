const fs = require('fs');
const got = require('got');
const datasource = require('../../lib/datasource');

jest.mock('got');

const allResponse = fs.readFileSync('test/_fixtures/gradle-wrapper/all.json');

let config = {};

describe('datasource/gradle', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      config = {
        type: 'bin',
        typeStrategy: 'auto',
        digests: 'true',
        digestsStrategy: 'true',
      };
      jest.clearAllMocks();
      global.repoCache = {};
      return global.renovateCache.rmAll();
    });

    it('returns null for empty result', async () => {
      got.mockReturnValueOnce({ body: {} });
      expect(await datasource.getPkgReleases('pkg:gradle', config)).toBeNull();
    });

    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(await datasource.getPkgReleases('pkg:gradle', config)).toBeNull();
    });

    it('returns null for 404 on checksum', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(allResponse),
      });
      got.mockImplementation(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(await datasource.getPkgReleases('pkg:gradle', config)).toBeNull();
    });

    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await datasource.getPkgReleases('pkg:gradle', config)).toBeNull();
    });

    it('returns null for unknown error on checksum', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(allResponse),
      });
      got.mockImplementation(() => {
        throw new Error();
      });
      expect(await datasource.getPkgReleases('pkg:gradle', config)).toBeNull();
    });

    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(allResponse),
      });
      got.mockReturnValue({
        body:
          '0000000000000000000000000000000000000000000000000000000000000000',
      });
      const res = await datasource.getPkgReleases('pkg:gradle', config);
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });

    it('processes real data and change type', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(allResponse),
      });
      got.mockReturnValue({
        body:
          '0000000000000000000000000000000000000000000000000000000000000000',
      });
      config.typeStrategy = 'all';
      const res = await datasource.getPkgReleases('pkg:gradle', config);
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });
  });
});
