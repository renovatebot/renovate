import fs from 'fs-extra';
import _simpleGit from 'simple-git/promise';
import * as globalCache from '../../util/cache/global';
import { getDigest, getReleases } from '.';

jest.mock('simple-git/promise');
const simpleGit: any = _simpleGit;

const lookupName = 'https://github.com/example/example.git';

const lsRemote1 = fs.readFileSync(
  'lib/datasource/git-refs/__fixtures__/ls-remote-1.txt',
  'utf8'
);

describe('datasource/git-tags', () => {
  beforeEach(() => globalCache.rmAll());
  describe('getReleases', () => {
    it('returns nil if response is wrong', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(null);
        },
      });
      const versions = await getReleases({ lookupName });
      expect(versions).toEqual(null);
    });
    it('returns nil if remote call throws exception', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          throw new Error();
        },
      });
      const versions = await getReleases({ lookupName });
      expect(versions).toEqual(null);
    });
    it('returns versions filtered from tags', async () => {
      simpleGit.mockReturnValue({
        listRemote() {
          return Promise.resolve(lsRemote1);
        },
      });

      const versions = await getReleases({
        lookupName,
      });
      expect(versions).toMatchSnapshot();
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
        'notfound'
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
        'v1.0.2'
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
