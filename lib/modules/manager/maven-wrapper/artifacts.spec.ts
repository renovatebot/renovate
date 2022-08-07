import type { StatusResult } from 'simple-git';
import { resolve } from 'upath';
import { git, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { updateArtifacts } from './artifacts';

jest.mock('../../../util/git');
jest.mock('os');

const fixtures = resolve(__dirname, './__fixtures__');
const adminConfig: RepoGlobalConfig = {
  localDir: resolve(fixtures, './'),
};

describe('modules/manager/maven-wrapper/artifacts', () => {
  afterEach(() => {
    GlobalConfig.reset();
  });

  it('Should not update if there is no dep with maven:wrapper', async () => {
    require('os').__setPlatform('darwin');
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven-wrapper',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'not-mavenwrapper' }],
      config: {},
    });
    expect(updatedDeps).toBeNull();
  });

  it('Should return java 7.0 when current value is larger then 3', async () => {
    require('os').__setPlatform('darwin');
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
      config: { currentValue: '3.3.1', newValue: '3.3.1' },
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

  it('Should not update deps when maven-wrapper.properties is not in git change', async () => {
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['maven.mvn/wrapper/not-maven-wrapper.properties'],
      })
    );

    GlobalConfig.set(adminConfig);

    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { newValue: '3.3.1' },
    });

    expect(updatedDeps).toEqual([]);
  });

  it('Should return an error when config is not set', async () => {
    const updatedDeps = await updateArtifacts({
      packageFileName: '',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { newValue: '3.3.1' },
    });

    const expectedError = [
      {
        artifactError: {
          lockFile: '',
          stderr:
            'The "path" argument must be of type string. Received undefined',
        },
      },
    ];

    expect(updatedDeps).toEqual(expectedError);
  });

  it('Should return null when cmd is not found', async () => {
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['maven.mvn/wrapper/not-maven-wrapper.properties'],
      })
    );
    GlobalConfig.set(adminConfig);
    require('os').__setPlatform('win32');
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { newValue: '3.3.1' },
    });

    expect(updatedDeps).toBeNull();
  });
});
