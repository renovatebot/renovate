import { getPkgReleases } from '../../lib/datasource/esy';

describe('datasource/esy', () => {
  describe('getPkgReleases', () => {
    it('returns versions for package abella', async () => {
      let res = await getPkgReleases({ lookupName: 'abella' });
      console.log(res);
    });
  });
});
