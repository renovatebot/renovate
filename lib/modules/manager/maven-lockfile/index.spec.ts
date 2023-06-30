import { Fixtures } from '../../../../test/fixtures';

const simpleContent = Fixtures.get(`simpleproject/pom.xml`);

import { updateArtifacts } from './index';

describe('modules/manager/maven-lockfile/index', () => {
  it('should generate lockfile in simpleproject', async () => {
    const packageFileName = './simpleproject/pom.xml';
    const newPackageFileContent = simpleContent;
    const updatedDeps = [
      {
        groupId: 'junit',
        artifactId: 'junit',
        version: '4.13.2',
        datasource: 'maven',
      },
    ];
    const config = {};

    const result = await updateArtifacts({
      packageFileName,
      newPackageFileContent,
      updatedDeps,
      config,
    });
    // no stderr check
    expect(result).toEqual([
      {
        artifactError: {
          lockFile: packageFileName,
          stderr: null,
        },
      },
    ]);
  });
});
