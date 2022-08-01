import type { StatusResult } from 'simple-git';
import { resolve } from 'upath';
import { git, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { updateArtifacts } from './artifacts';

jest.mock('../../../util/git');

const fixtures = resolve(__dirname, './__fixtures__');
const adminConfig: RepoGlobalConfig = {
  localDir: resolve(fixtures, './'),
};

describe('modules/manager/maven-wrapper/artifacts', () => {
  it('Should not update if there is no dep with maven:wrapper', async () => {
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven-wrapper',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'not-mavenwrapper' }],
      config: {},
    });
    expect(updatedDeps).toBeNull();
  });

  it('Should update when it is maven wrapper', async () => {
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['maven.mvn/wrapper/maven-wrapper.properties'],
      })
    );

    GlobalConfig.set(adminConfig);

    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { newValue: '3.3.1' },
    });

    const expected = [
      {
        file: {
          contents: null,
          path: 'maven.mvn/wrapper/maven-wrapper.properties',
          type: 'addition',
        },
      },
    ];

    expect(updatedDeps).toEqual(expected);
  });
});
