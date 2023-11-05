import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

jest.mock('../../../util/fs');

const config: UpdateArtifactsConfig = {};

const initialCartfile = Fixtures.get('Cartfile.initial');
const initialCartfileResolved = Fixtures.get('Cartfile.resolved.initial');
const finalCartfileResolvedBinary = Fixtures.get(
  'Cartfile.resolved.final_binary'
);
const finalCartfileResolvedGit = Fixtures.get('Cartfile.resolved.final_git');

describe('modules/manager/carthage/artifacts', () => {
  afterEach(() => {
    GlobalConfig.reset();
  });

  it('returns null if no Cartfile.resolved found', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'Cartfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if no updatedDeps were provided', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'Cartfile',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null for invalid local directory', async () => {
    GlobalConfig.set({
      localDir: '',
    });

    expect(
      await updateArtifacts({
        packageFileName: 'Cartfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config: {},
      })
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'Cartfile',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns updated Cartfile.resolved for binary package', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Cartfile.resolved');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cartfile');
    fs.readLocalFile.mockResolvedValueOnce(initialCartfileResolved);
    expect(
      await updateArtifacts({
        packageFileName: 'Cartfile',
        updatedDeps: [
          {
            depName: 'MyFramework',
            managerData: { lineNumber: 4 },
            newVersion: '3.2.1',
          },
        ],
        newPackageFileContent: initialCartfile,
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'Cartfile.resolved',
          contents: finalCartfileResolvedBinary,
        },
      },
    ]);
  });

  it('returns updated Cartfile.resolved for git package', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Cartfile.resolved');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cartfile');
    fs.readLocalFile.mockResolvedValueOnce(initialCartfileResolved);
    expect(
      await updateArtifacts({
        packageFileName: 'Cartfile',
        updatedDeps: [
          {
            depName: 'ReactiveCocoa',
            managerData: { lineNumber: 1 },
            newVersion: '4.0.1',
          },
        ],
        newPackageFileContent: initialCartfile,
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'Cartfile.resolved',
          contents: finalCartfileResolvedGit,
        },
      },
    ]);
  });

  it('catches write error on Cartfile', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Cartfile.resolved');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cartfile');
    fs.readLocalFile.mockResolvedValueOnce(initialCartfileResolved);
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'Cartfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config,
      })
    ).toEqual([
      { artifactError: { lockFile: 'Cartfile', stderr: 'not found' } },
    ]);
  });

  it('catches write error on Cartfile.resolved', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Cartfile.resolved');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cartfile');
    fs.readLocalFile.mockResolvedValueOnce(initialCartfileResolved);
    fs.writeLocalFile.mockResolvedValueOnce();
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'Cartfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config,
      })
    ).toEqual([
      { artifactError: { lockFile: 'Cartfile.resolved', stderr: 'not found' } },
    ]);
  });
});
