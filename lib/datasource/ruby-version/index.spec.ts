import fs from 'fs';
import _got from '../../util/got';
import { getReleases } from '.';

jest.mock('../../util/got');

const got: any = _got;

const rubyReleasesHtml = fs.readFileSync(
  'lib/datasource/ruby-version/__fixtures__/releases.html',
  'utf8'
);

describe('datasource/gradle', () => {
  describe('getReleases', () => {
    it('parses real data', async () => {
      got.mockReturnValueOnce({
        body: rubyReleasesHtml,
      });
      const res = await getReleases();
      expect(res).toMatchSnapshot();
    });
    it('throws for empty result', async () => {
      got.mockReturnValueOnce({ body: {} });
      await expect(getReleases()).rejects.toThrow();
    });

    it('throws for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      await expect(getReleases()).rejects.toThrow();
    });
  });
});
