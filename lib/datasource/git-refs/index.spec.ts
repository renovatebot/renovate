import fs from 'fs-extra';
import _simpleGit from 'simple-git';
import { getPkgReleases } from '..';
import { getName } from '../../../test/util';
import { id as datasource, getDigest } from '.';

jest.mock('simple-git');
const simpleGit: any = _simpleGit;

const depName = 'https://github.com/example/example.git';

const lsRemote1 = fs.readFileSync(
  'lib/datasource/git-refs/__fixtures__/ls-remote-1.txt',
  'utf8'
);

describe(getName(__filename), () => {
  describe('getReleases', () => {
    it('returns nil if response is wrong', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(null);
        },
      });
      const versions = await getPkgReleases({
        datasource,
        depName,
      });
      expect(versions).toBeNull();
    });
    it('returns nil if remote call throws exception', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          throw new Error();
        },
      });
      const versions = await getPkgReleases({
        datasource,
        depName,
      });
      expect(versions).toBeNull();
    });
    it('returns versions filtered from tags', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1);
        },
      });

      const versions = await getPkgReleases({
        datasource,
        depName,
      });
      expect(versions).toMatchSnapshot();
      const result = versions.releases.map((x) => x.version).sort();
      expect(result).toHaveLength(6);
    });
  });
  describe('getDigest()', () => {
    it('returns null if not found', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1);
        },
      });
      const digest = await getDigest(
        { lookupName: 'a tag to look up' },
        'v2.0.0'
      );
      expect(digest).toBeNull();
    });
    it('returns digest for tag', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1);
        },
      });
      const digest = await getDigest(
        { lookupName: 'a tag to look up' },
        'v1.0.4'
      );
      expect(digest).toMatchSnapshot();
    });
    it('returns digest for HEAD', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1);
        },
      });
      const digest = await getDigest(
        { lookupName: 'another tag to look up' },
        undefined
      );
      expect(digest).toMatchSnapshot();
    });
  });
});
