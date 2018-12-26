const got = require('got');
const fs = require('fs');
const { getPkgReleases } = require('../../lib/datasource/cargo');

let res1 = fs.readFileSync('test/_fixtures/cargo/libc.json', 'utf8');
res1 = JSON.parse(res1);
let res2 = fs.readFileSync('test/_fixtures/cargo/amethyst.json', 'utf8');
res2 = JSON.parse(res2);

jest.mock('got');

describe('datasource/cargo', () => {
  describe('getPkgReleases', () => {
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce(null);
      expect(
        await getPkgReleases({ fullname: 'non_existent_crate' })
      ).toBeNull();
    });
    it('returns null for missing fields', async () => {
      got.mockReturnValueOnce({ crate: {} });
      expect(
        await getPkgReleases({ fullname: 'non_existent_crate' })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(await getPkgReleases({ fullname: 'some_crate' })).toBeNull();
    });
    it('throws for 5xx', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      let e;
      try {
        await getPkgReleases({ fullname: 'some_crate' });
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await getPkgReleases('some_crate')).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      const res = await getPkgReleases({ fullname: 'libc' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: res2,
      });
      const res = await getPkgReleases({ fullname: 'amethyst' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
  });
});
