import fs from 'fs';
import { join } from 'upath';
import { git, partial } from '../../../../test/util';

import { GlobalConfig } from '../../../config/global';
import type { StatusResult } from '../../../util/git/types';
import { updateArtifacts } from './lockfile';

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
      let tempFilePath: string | undefined = undefined;
      try {
        tempFilePath = createDummyLockfile('simpleprojectWithLockfile');
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
      } finally {
        if (tempFilePath) {
          await deleteDummyLockfile(tempFilePath);
        }
      }
    });

    it('only lockfiles which are modified are added', async () => {
      let tempFilePath: string | undefined = undefined;
      try {
        tempFilePath = createDummyLockfile('simpleprojectWithLockfile');
        mockLockfileCreatedInGit();
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
        expect(result).toHaveLength(0);
      } finally {
        if (tempFilePath) {
          await deleteDummyLockfile(tempFilePath);
        }
      }
    });

    it('parent/child project work', async () => {
      let tempFilePath: string | undefined = undefined;
      try {
        tempFilePath = createDummyLockfile(
          'parent_child/simpleprojectWithLockfile'
        );
        mockLockfileChangedInGit('simpleprojectWithLockfile');
        GlobalConfig.set({
          localDir: join(
            'lib/modules/manager/maven/__fixtures__/parent_child/'
          ),
        });
        const result = await updateArtifacts({
          packageFileName:
            'lib/modules/manager/maven/__fixtures__/parent_child/simpleprojectWithLockfile/pom.xml',
          updatedDeps: [{ datasource: 'maven' }],
          newPackageFileContent: '{}',
          config: {},
        });
        expect(result).not.toBeNull();
        expect(result).toHaveLength(1);
      } finally {
        if (tempFilePath) {
          await deleteDummyLockfile(tempFilePath);
        }
      }
    });
  });
});

function createDummyLockfile(subproject: string) {
  const tempFilePath = join(
    __dirname,
    '__fixtures__',
    subproject,
    'lockfile.json'
  );
  fs.writeFileSync(tempFilePath, '{}', 'utf8');
  return tempFilePath;
}

async function deleteDummyLockfile(tempFilePath: string) {
  await fs.promises.unlink(tempFilePath);
}

jest.mock('../../../util/git');

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
function mockLockfileCreatedInGit(pathToFile?: string) {
  if (pathToFile) {
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        created: [`${pathToFile}/lockfile.json`],
      })
    );
  } else {
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        created: ['lockfile.json'],
      })
    );
  }
}
