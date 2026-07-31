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

describe('modules/manager/gemspec/artifacts', () => {
  beforeEach(() => {
    fs.getSiblingFileName.mockImplementation(
      (_packageFile, otherFile) => `sub/${otherFile}`,
    );
  });

  it('returns null when there is no sibling Gemfile.lock', async () => {
    fs.localPathExists.mockResolvedValue(false);
    expect(await updateArtifacts(updateArtifact)).toBeNull();
    expect(fs.readLocalFile).not.toHaveBeenCalled();
    expect(lock.runBundlerLock).not.toHaveBeenCalled();
  });

  it('returns null when there is no sibling Gemfile', async () => {
    fs.localPathExists.mockResolvedValue(true);
    fs.readLocalFile.mockResolvedValue(null);
    expect(await updateArtifacts(updateArtifact)).toBeNull();
    expect(lock.runBundlerLock).not.toHaveBeenCalled();
  });

  it('returns null when the Gemfile has no gemspec directive', async () => {
    fs.localPathExists.mockResolvedValue(true);
    fs.readLocalFile.mockResolvedValue(
      "source 'https://rubygems.org'\n# gemspec\ngem 'rack'\n",
    );
    expect(await updateArtifacts(updateArtifact)).toBeNull();
    expect(lock.runBundlerLock).not.toHaveBeenCalled();
  });

  it('delegates to runBundlerLock when the Gemfile uses the gemspec directive', async () => {
    fs.localPathExists.mockResolvedValue(true);
    fs.readLocalFile.mockResolvedValue(
      "source 'https://rubygems.org'\n\ngemspec name: 'foo'\n",
    );
    const result = [
      {
        file: {
          type: 'addition' as const,
          path: 'sub/Gemfile.lock',
          contents: 'x',
        },
      },
    ];
    lock.runBundlerLock.mockResolvedValue(result);
    expect(await updateArtifacts(updateArtifact)).toBe(result);
    expect(lock.runBundlerLock).toHaveBeenCalledWith(
      updateArtifact,
      'sub/Gemfile.lock',
    );
  });
});
