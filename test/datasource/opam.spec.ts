import { getPkgReleases } from '../../lib/datasource/opam';

describe('datasource/opam', () => {
  describe('getPkgReleases', () => {
    it('returns versions for package abella', async () => {
      let res = await getPkgReleases({ lookupName: 'abella' });
    });
  });
});
