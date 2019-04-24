const fs = require('fs');
const got = require('../../lib/util/got');
const { getPkgReleases } = require('../../lib/datasource/ruby-version');

jest.mock('../../lib/util/got');

const rubyReleasesHtml = fs.readFileSync(
  'test/datasource/ruby-version/_fixtures/releases.html',
  'utf8'
);

describe('datasource/gradle', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      global.repoCache = {};
      return global.renovateCache.rmAll();
    });
    it('parses real data', async () => {
      got.mockReturnValueOnce({
        body: rubyReleasesHtml,
      });
      const res = await getPkgReleases();
      expect(res).toMatchSnapshot();
    });
    it('throws for empty result', async () => {
      got.mockReturnValueOnce({ body: {} });
      await expect(getPkgReleases()).rejects.toThrow();
    });

    it('throws for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      await expect(getPkgReleases()).rejects.toThrow();
    });
  });
});
