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
    it('parses real data', async () => {
      got.mockReturnValueOnce({
        body: rubyReleasesHtml,
      });
      const res = await getPkgReleases();
      expect(res).toMatchSnapshot();
    });
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce({ body: {} });
      expect(await getPkgReleases()).toBeNull();
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
