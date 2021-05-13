import _simpleGit from 'simple-git';
import { dir } from 'tmp-promise';
import { getName } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import type { Upgrade } from '../types';
import updateDependency from './update';

jest.mock('simple-git');
const simpleGit: any = _simpleGit;

describe(getName(), () => {
  describe('updateDependency', () => {
    let upgrade: Upgrade;
    beforeAll(async () => {
      const tmpDir = await dir();
      setAdminConfig({ localDir: tmpDir.path });
      upgrade = { depName: 'renovate' };
    });
    afterAll(() => {
      setAdminConfig();
    });
    it('returns null on error', async () => {
      simpleGit.mockReturnValue({
        submoduleUpdate() {
          throw new Error();
        },
      });
      const update = await updateDependency({
        fileContent: '',
        upgrade,
      });
      expect(update).toBeNull();
    });
    it('returns content on update', async () => {
      simpleGit.mockReturnValue({
        submoduleUpdate() {
          return Promise.resolve();
        },
        checkout() {
          return Promise.resolve();
        },
      });
      const update = await updateDependency({
        fileContent: '',
        upgrade,
      });
      expect(update).toEqual('');
    });
  });
});
