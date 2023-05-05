import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from './artifacts';

jest.mock('../../../util/fs');

const config: UpdateArtifactsConfig = {};

describe('modules/manager/pep621/artifacts', () => {
  describe('updateArtifacts()', () => {
    it('return null if all processors returns are empty', async () => {
      const updatedDeps = [{ depName: 'dep1' }];
      const result = await updateArtifacts({
        packageFileName: 'pyproject.toml',
        newPackageFileContent: '',
        config,
        updatedDeps,
      });
      expect(result).toBeNull();
    });
  });
});
