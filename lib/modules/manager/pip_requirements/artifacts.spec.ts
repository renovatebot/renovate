import { fs, mockedFunction } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import { exec } from '../../../util/exec';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

jest.mock('child_process');
jest.mock('../../../util/exec');
jest.mock('../../../util/fs');
const mockedExec = mockedFunction(exec);

const config: UpdateArtifactsConfig = {};

const newPackageFileContent = `aniso8601==9.0.1 \
--hash=sha256:1d2b7ef82963909e93c4f24ce48d4de9e66009a21bf1c1e1c85bdd0812fe412f \
--hash=sha256:72e3117667eedf66951bb2d93f4296a56b94b078a8a95905a052611fb3f1b973\n\
atomicwrites==1.4.0 \
--hash=sha256:03472c30eb2c5d1ba9227e4c2ca66ab8287fbfbbda3888aa93dc2e28fc6811b4 \
--hash=sha256:75a9445bac02d8d058d5e1fe689654ba5a6556a1dfd8ce6ec55a0ed79866cfa6\n\
boto3-stubs[iam]==1.24.36.post1 \
--hash=sha256:39acbbc8c87a101bdf46e058fbb012d044b773b43f7ed02cc4c24192a564411e \
--hash=sha256:ca3b3066773fc727fea0dbec252d098098e45fe0def011b22036ef674344def2\n\
botocore==1.27.46 \
--hash=sha256:747b7e94aef41498f063fc0be79c5af102d940beea713965179e1ead89c7e9ec \
--hash=sha256:f66d8305d1f59d83334df9b11b6512bb1e14698ec4d5d6d42f833f39f3304ca7`;

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
    ['dependency w/o extras', 'atomicwrites'],
    ['dependency with extras', 'boto3-stubs'],
  ])(
    'returns null if %s unchanged',
    async (_description: string, depName: string) => {
      fs.readLocalFile.mockResolvedValueOnce(newPackageFileContent);
      expect(
        await updateArtifacts({
          packageFileName: 'requirements.txt',
          updatedDeps: [{ depName }],
          newPackageFileContent,
          config,
        })
      ).toBeNull();
    }
  );

  it.each([
    ['dependency w/o extras', 'atomicwrites', 'atomicwrites==1.4.0'],
    [
      'dependency with extras',
      'boto3-stubs',
      'boto3-stubs[iam]==1.24.36.post1',
    ],
  ])(
    'returns updated file for %s',
    async (
      _description: string,
      depName: string,
      expectedDependencyConstraint: string
    ) => {
      fs.readLocalFile.mockResolvedValueOnce('new content');
      expect(
        await updateArtifacts({
          packageFileName: 'requirements.txt',
          updatedDeps: [{ depName }],
          newPackageFileContent,
          config,
        })
      ).toHaveLength(1);
      // verify we captured the dependency correctly
      expect(mockedExec.mock.calls[0][0]).toStrictEqual([
        `hashin ${expectedDependencyConstraint} -r requirements.txt`,
      ]);
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
