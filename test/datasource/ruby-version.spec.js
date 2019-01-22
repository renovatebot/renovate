const fs = require('fs');
const got = require('got');
const { getPkgReleases } = require('../../lib/datasource/ruby-version');

jest.mock('got');

const rubyReleasesHtml = fs.readFileSync(
  'test/_fixtures/ruby-version/releases.html',
  'utf8'
);

describe('datasource/gradle', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => global.renovateCache.rmAll());
    it('parses real data', async () => {
      got.mockReturnValueOnce({
        body: rubyReleasesHtml,
      });
      const res = await getPkgReleases();
      expect(res).toMatchSnapshot();
    });
    it('throws for empty result', async () => {
      got.mockReturnValueOnce({ body: {} });
      let e;
      try {
        await getPkgReleases();
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });

    it('throws for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      let e;
      try {
        await getPkgReleases();
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
  });
});
