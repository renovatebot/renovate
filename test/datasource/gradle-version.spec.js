const fs = require('fs');
const got = require('../../lib/util/got');
const datasource = require('../../lib/datasource');

jest.mock('../../lib/util/got');

const allResponse = fs.readFileSync(
  'test/datasource/gradle-wrapper/_fixtures/all.json'
);

let config = {};

describe('datasource/gradle', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      config = {
        datasource: 'gradleVersion',
        gradleWrapperType: 'bin',
        typeStrategy: 'auto',
        digests: 'true',
        digestsStrategy: 'true',
      };
      jest.clearAllMocks();
      global.repoCache = {};
      return global.renovateCache.rmAll();
    });

    it('throws for empty result', async () => {
      got.mockReturnValueOnce({ body: {} });
      await expect(
        datasource.getPkgReleases({
          ...config,
        })
      ).rejects.toThrow();
    });

    it('throws for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      await expect(
        datasource.getPkgReleases({
          ...config,
        })
      ).rejects.toThrow();
    });

    it('throws for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      await expect(
        datasource.getPkgReleases({
          ...config,
        })
      ).rejects.toThrow();
    });

    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(allResponse),
      });
      const res = await datasource.getPkgReleases(config);
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });
  });
});
