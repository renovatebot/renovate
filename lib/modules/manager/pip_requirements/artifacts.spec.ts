import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

jest.mock('child_process');
jest.mock('../../../util/exec');
jest.mock('../../../util/fs');

const config: UpdateArtifactsConfig = {};

const newPackageFileContent = `atomicwrites==1.4.0 \
--hash=sha256:03472c30eb2c5d1ba9227e4c2ca66ab8287fbfbbda3888aa93dc2e28fc6811b4 \
--hash=sha256:75a9445bac02d8d058d5e1fe689654ba5a6556a1dfd8ce6ec55a0ed79866cfa6`;

const newPackageFileContentWithExtra = `boto3-stubs[iam]==1.24.36.post1 \
--hash=sha256:39acbbc8c87a101bdf46e058fbb012d044b773b43f7ed02cc4c24192a564411e \
--hash=sha256:ca3b3066773fc727fea0dbec252d098098e45fe0def011b22036ef674344def2`;

describe('modules/manager/pip_requirements/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    GlobalConfig.set({ localDir: '' });
  });

  it('returns null if no updatedDeps were provided', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.txt',
        updatedDeps: [],
        newPackageFileContent,
        config,
      })
    ).toBeNull();
  });

  it('returns null if no hashes', async () => {
    fs.readLocalFile.mockResolvedValueOnce('eventlet==0.30.2\npbr>=1.9\n');
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.txt',
        updatedDeps: [{ depName: 'eventlet' }],
        newPackageFileContent,
        config,
      })
    ).toBeNull();
  });

  it.each([
    ['dependency w/o extras', 'atomicwrites', newPackageFileContent],
    ['dependency with extras', 'boto3-stubs', newPackageFileContentWithExtra],
  ])(
    'returns null if %s unchanged',
    async (
      _description: string,
      depName: string,
      packageFileContent: string
    ) => {
      fs.readLocalFile.mockResolvedValueOnce(packageFileContent);
      expect(
        await updateArtifacts({
          packageFileName: 'requirements.txt',
          updatedDeps: [{ depName }],
          newPackageFileContent: packageFileContent,
          config,
        })
      ).toBeNull();
    }
  );

  it.each([
    ['dependency w/o extras', 'atomicwrites', newPackageFileContent],
    ['dependency with extras', 'boto3-stubs', newPackageFileContentWithExtra],
  ])(
    'returns updated file',
    async (
      _description: string,
      depName: string,
      packageFileContent: string
    ) => {
      fs.readLocalFile.mockResolvedValueOnce('new content');
      expect(
        await updateArtifacts({
          packageFileName: 'requirements.txt',
          updatedDeps: [{ depName }],
          newPackageFileContent: packageFileContent,
          config,
        })
      ).toHaveLength(1);
    }
  );

  it('catches and returns errors', async () => {
    fs.readLocalFile.mockImplementation(() => {
      throw new Error('some-error');
    });
    expect(
      await updateArtifacts({
        packageFileName: '',
        updatedDeps: [{ depName: 'atomicwrites' }],
        newPackageFileContent,
        config,
      })
    ).toHaveLength(1);
  });
});
