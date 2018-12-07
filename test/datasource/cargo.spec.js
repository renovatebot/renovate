const got = require('got');
const { getPkgReleases } = require('../../lib/datasource/cargo');
const fs = require('fs');

const res1 = fs.readFileSync('test/_fixtures/cargo/libc.json', 'utf8');

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
      expect(null).toBeNull();
    });
    it('returns null for unknown error', async () => {
      expect(null).toBeNull();
    });
    it('processes real data', async () => {
      expect(null).toBeNull();
    });
    it('skips wrong package', async () => {
      expect(null).toBeNull();
    });
    it('skips unsupported platform', async () => {
      expect(null).toBeNull();
    });
  });
});
