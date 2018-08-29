const fs = require('fs');
const got = require('got');
const datasource = require('../../lib/datasource');

jest.mock('got');

const res1 = fs.readFileSync('test/_fixtures/packagist/uploader.json');
const res2 = fs.readFileSync('test/_fixtures/packagist/mailchimp-api.json');

describe('datasource/packagist', () => {
  describe('getPkgReleases', () => {
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce({});
      expect(
        await datasource.getPkgReleases('pkg:packagist/something')
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(
        await datasource.getPkgReleases('pkg:packagist/something')
      ).toBeNull();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await datasource.getPkgReleases('pkg:packagist/something')
      ).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(res1),
      });
      expect(
        await datasource.getPkgReleases('pkg:packagist/cristianvuolo/uploader')
      ).toMatchSnapshot();
    });
    it('processes real versioned data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(res2),
      });
      expect(
        await datasource.getPkgReleases('pkg:packagist/drewm/mailchimp-api')
      ).toMatchSnapshot();
    });
  });
});
