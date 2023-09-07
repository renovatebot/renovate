import { join } from 'upath';
import { git, partial } from '../../../../test/util';

import { GlobalConfig } from '../../../config/global';
import type { StatusResult } from '../../../util/git/types';
import { updateArtifacts } from './lockfile';
import { getLockfileVersion } from './lockfile';

jest.mock('../../../util/git');

describe('modules/manager/maven/lockfile', () => {
  describe('updateArtifacts()', () => {
    it('returns null if no Maven dependencies are updated', async () => {
      expect.assertions(1);
      const result = await updateArtifacts({
        packageFileName:
          'lib/modules/manager/maven/__fixtures__/simpleproject/pom.xml',
        updatedDeps: [{ datasource: 'npm' }],
        newPackageFileContent: '{}',
        config: {},
      });
      expect(result).toBeNull();
    });

    it('if there is lockfile found the lockfile is updated', async () => {
      mockLockfileChangedInGit();
      GlobalConfig.set({
        localDir: join(
          'lib/modules/manager/maven/__fixtures__/simpleprojectWithLockfile'
        ),
      });
      const result = await updateArtifacts({
        packageFileName:
          'lib/modules/manager/maven/__fixtures__/simpleprojectWithLockfile/pom.xml',
        updatedDeps: [{ datasource: 'maven' }],
        newPackageFileContent: '{}',
        config: {},
      });
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].file?.path).toBe('lockfile.json');
    });
    describe('getLockfileVersion()', () => {
      it('Reading the version from a lockfile returns the correct version', async () => {
        const version = await getLockfileVersion(
          'lib/modules/manager/maven/__fixtures__/simpleprojectWithLockfile/'
        );
        expect(version).toBe('5.0.0');
      });
    });
  });

  function mockLockfileChangedInGit(pathToFile?: string) {
    if (pathToFile) {
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [`${pathToFile}/lockfile.json`],
        })
      );
    } else {
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['lockfile.json'],
        })
      );
    }
  }
});
