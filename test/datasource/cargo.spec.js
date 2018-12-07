const got = require('got');
const { getPkgReleases } = require('../../lib/datasource/cargo');
const fs = require('fs');

let res1 = fs.readFileSync('test/_fixtures/cargo/libc.json', 'utf8');
res1 = JSON.parse(res1);

jest.mock('got');

describe('datasource/cargo', () => {
  describe('getPkgReleases', () => {
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce(null);
      expect(
        await getPkgReleases('non_existent_crate')
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
                                 Promise.reject({
                                   statusCode: 404,
                                 })
                                );
      expect(
        await getPkgReleases('some_crate')
      ).toBeNull();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await getPkgReleases('some_crate')
      ).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      const res = await getPkgReleases({fullname: 'libc'});
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
    it('skips wrong package', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      const res = await getPkgReleases('wrong_crate');
      expect(res).toBeNull();
    });
  });
});
