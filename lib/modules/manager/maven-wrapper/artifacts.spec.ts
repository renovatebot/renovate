import type { StatusResult } from 'simple-git';
import { git, partial } from '../../../../test/util';
import type { RepoGlobalConfig } from '../../../config/types';
import { updateArtifacts } from './artifacts';
import { resolve } from 'upath';
import { GlobalConfig } from '../../../config/global';
import { Stats } from 'fs';

//const fs = require('../../../util/fs');
jest.mock('../../../util/exec/common');
//jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('../../../util/exec/env');
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
        modified: ['maven/wrapper/maven-wrapper.properties'],
      })
    );

    GlobalConfig.set(adminConfig);

    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven-wrapper',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { newValue: '3.3.1' },
    });

    expect(updatedDeps).toBeNull();
  });
});
