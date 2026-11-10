import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import * as _lock from '../bundler/lock.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';

vi.mock('../../../util/fs/index.ts');
vi.mock('../bundler/lock.ts');

const lock = vi.mocked(_lock);

const updateArtifact: UpdateArtifact = {
  packageFileName: 'sub/foo.gemspec',
  updatedDeps: [{ depName: 'rack' }],
  newPackageFileContent: 'gem.add_dependency "rack", "~> 3.1"',
  config: {},
};

const ownLockFile = codeBlock`
  PATH
    remote: .
    specs:
      foo (1.0.0)
        rack (~> 3.1)
`;

describe('modules/manager/gemspec/artifacts', () => {
  beforeEach(() => {
    fs.getSiblingFileName.mockImplementation(
      (_packageFile, otherFile) => `sub/${otherFile}`,
    );
  });

  it('returns null when there is no sibling Gemfile.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);

    const res = await updateArtifacts(updateArtifact);

    expect(res).toBeNull();
    expect(lock.runBundlerLock).not.toHaveBeenCalled();
  });

  it('returns null when the Gemfile.lock does not lock the gemspec', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      ownLockFile.replace('remote: .', 'remote: engines/foo'),
    );

    const res = await updateArtifacts(updateArtifact);

    expect(res).toBeNull();
    expect(lock.runBundlerLock).not.toHaveBeenCalled();
  });

  it('delegates to runBundlerLock when the Gemfile.lock locks the gemspec', async () => {
    fs.readLocalFile.mockResolvedValueOnce(ownLockFile);
    const result = [
      {
        file: {
          type: 'addition' as const,
          path: 'sub/Gemfile.lock',
          contents: 'x',
        },
      },
    ];
    lock.runBundlerLock.mockResolvedValueOnce(result);

    const res = await updateArtifacts(updateArtifact);

    expect(res).toBe(result);
    expect(lock.runBundlerLock).toHaveBeenCalledWith(
      updateArtifact,
      'sub/Gemfile.lock',
    );
  });
});
