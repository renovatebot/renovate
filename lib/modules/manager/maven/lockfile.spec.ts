import fs from 'fs';
import path from 'path';
import { updateArtifacts } from './lockfile';

describe('modules/manager/maven/lockfile', () => {
  describe('updateArtifacts()', () => {
    //   it('null if no datasource=maven found', async () => {
    //     expect.assertions(1);
    //     const result =  await updateArtifacts({
    //       packageFileName: 'pom.xml',
    //       updatedDeps: [],
    //       newPackageFileContent: '{}',
    //       config: {},
    //     });
    //     return expect(result).resolves.toBeNull();
    //   });

    // it('returns null if no Maven dependencies are updated', async () => {
    //   expect.assertions(1);
    //   const result = await updateArtifacts({
    //     packageFileName:
    //       'lib/modules/manager/maven/__fixtures__/simpleproject/pom.xml',
    //     updatedDeps: [{ datasource: 'npm' }],
    //     newPackageFileContent: '{}',
    //     config: {},
    //   });
    //   expect(result).toBeNull();
    // });

    it('if there is lockfile found the lockfile is updated', async () => {
      let tempFilePath: string | undefined = undefined;
      try {
        tempFilePath = createDummyLockfile();
        const result = await updateArtifacts({
          packageFileName:
            'lib/modules/manager/maven/__fixtures__/simpleprojectWithLockfile/pom.xml',
          updatedDeps: [{ datasource: 'maven' }],
          newPackageFileContent: '{}',
          config: {},
        });
        expect(result).not.toBeNull();
      } finally {
        if (tempFilePath) {
          await deleteDummyLockfile(tempFilePath);
        }
      }
    });
  });
});

function createDummyLockfile() {
  const tempFilePath = path.join(
    __dirname,
    '__fixtures__',
    'simpleprojectWithLockfile',
    'lockfile.json'
  );
  fs.writeFileSync(tempFilePath, '{}', 'utf8');
  return tempFilePath;
}

async function deleteDummyLockfile(tempFilePath: string) {
  await fs.promises.unlink(tempFilePath);
}
