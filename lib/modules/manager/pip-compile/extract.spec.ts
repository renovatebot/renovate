import { join } from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { extractAllPackageFiles, extractPackageFile } from '.';

jest.mock('../../../util/fs');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};

function getSimpleRequirementsFile(command: string, deps: string[] = []) {
  return `#
# This file is autogenerated by pip-compile with Python 3.11
# by the following command:
#
#    ${command}
#

${deps.join('\n')}`;
}

describe('modules/manager/pip-compile/extract', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  afterEach(() => {
    fs.readLocalFile.mockClear();
  });

  describe('extractPackageFile()', () => {
    it('returns object for requirements.in', () => {
      const packageFile = extractPackageFile(
        Fixtures.get('requirementsWithHashes.txt'),
        'requirements.in',
        {},
      );
      expect(packageFile).toHaveProperty('deps');
      expect(packageFile?.deps[0]).toHaveProperty('depName', 'attrs');
    });

    it('returns object for setup.py', () => {
      const packageFile = extractPackageFile(
        Fixtures.get('setup.py', '../pip_setup'),
        'lib/setup.py',
        {},
      );
      expect(packageFile).toHaveProperty('deps');
      expect(packageFile?.deps[0]).toHaveProperty('depName', 'celery');
    });

    it.each([
      'random.py',
      'app.cfg',
      'already_locked.txt',
      // TODO(not7cd)
      'pyproject.toml',
      'setup.cfg',
    ])('returns null on not supported package files', (file: string) => {
      expect(extractPackageFile('some content', file, {})).toBeNull();
    });
  });

  describe('extractAllPackageFiles()', () => {
    it('support package file with multiple lock files', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        getSimpleRequirementsFile(
          'pip-compile --output-file=requirements1.txt requirements.in',
          ['foo==1.0.1'],
        ),
      );
      // requirements.in is parsed only once
      fs.readLocalFile.mockResolvedValueOnce('foo>=1.0.0');
      fs.readLocalFile.mockResolvedValueOnce(
        getSimpleRequirementsFile(
          'pip-compile --output-file=requirements2.txt requirements.in',
          ['foo==1.0.2'],
        ),
      );
      fs.readLocalFile.mockResolvedValueOnce(
        getSimpleRequirementsFile(
          'pip-compile --output-file=requirements3.txt requirements.in',
          ['foo==1.0.3'],
        ),
      );

      const lockFiles = [
        'requirements1.txt',
        'requirements2.txt',
        'requirements3.txt',
      ];
      const packageFiles = await extractAllPackageFiles({}, lockFiles);
      expect(packageFiles).not.toBeNull();
      expect(packageFiles!.pop()).toHaveProperty('lockFiles', lockFiles);
    });

    it('no lock files in returned package files', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        getSimpleRequirementsFile('pip-compile --output-file=foo.txt foo.in', [
          'foo==1.0.1',
        ]),
      );
      fs.readLocalFile.mockResolvedValueOnce('foo>=1.0.0');
      fs.readLocalFile.mockResolvedValueOnce(
        getSimpleRequirementsFile(
          'pip-compile --output-file=bar.txt bar.in foo.txt',
          ['foo==1.0.1', 'bar==2.0.0'],
        ),
      );
      fs.readLocalFile.mockResolvedValueOnce('bar>=1.0.0');

      const lockFiles = ['foo.txt', 'bar.txt'];
      const packageFiles = await extractAllPackageFiles({}, lockFiles);
      expect(fs.readLocalFile).toHaveBeenCalledTimes(4);
      expect(packageFiles).not.toBeNull();
      packageFiles!.forEach((packageFile) => {
        expect(packageFile).not.toHaveProperty('packageFile', 'foo.txt');
      });
    });

    // TODO(not7cd): update when constraints are supported
    it('no constraint files in returned package files', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        getSimpleRequirementsFile(
          'pip-compile --output-file=requirements.txt --constraint=constraints.txt requirements.in',
          ['foo==1.0.1'],
        ),
      );
      fs.readLocalFile.mockResolvedValueOnce('foo>=1.0.0');

      const lockFiles = ['requirements.txt'];
      const packageFiles = await extractAllPackageFiles({}, lockFiles);
      expect(packageFiles).not.toBeNull();
      packageFiles!.forEach((packageFile) => {
        expect(packageFile).not.toHaveProperty(
          'packageFile',
          'constraints.txt',
        );
      });
    });
  });

  it('return null for malformed files', async () => {
    // empty.txt
    fs.readLocalFile.mockResolvedValueOnce('');
    // noHeader.txt
    fs.readLocalFile.mockResolvedValueOnce(
      Fixtures.get('requirementsNoHeaders.txt'),
    );
    // badSource.txt
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile(
        'pip-compile --output-file=badSource.txt malformed.in empty.in',
        ['foo==1.0.1'],
      ),
    );
    // malformed.in
    fs.readLocalFile.mockResolvedValueOnce('!@#$');
    // empty.in
    fs.readLocalFile.mockResolvedValueOnce('');
    // headerOnly.txt
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile(
        'pip-compile --output-file=headerOnly.txt reqs.in',
        [],
      ),
    );

    const lockFiles = [
      'empty.txt',
      'noHeader.txt',
      'badSource.txt',
      'headerOnly.txt',
    ];
    const packageFiles = await extractAllPackageFiles({}, lockFiles);
    expect(packageFiles).toBeNull();
    expect(fs.readLocalFile).toHaveBeenCalledTimes(6);
    expect(logger.warn).toHaveBeenCalledTimes(2); // malformed.in, noHeader.txt
  });

  it('return null for bad paths', async () => {
    // ambigous.txt
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile(
        'pip-compile --output-file=../ambigous.txt reqs.in',
        ['foo==1.0.1'],
      ),
    );
    // badSource.txt
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile(
        'pip-compile --output-file=badSource.txt ../outside.in',
        ['foo==1.0.1'],
      ),
    );

    const packageFiles = await extractAllPackageFiles({}, [
      'subdir/ambigous.txt',
      'badSource.txt',
    ]);
    expect(packageFiles).toBeNull();
    expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('return for valid paths', async () => {
    // reqs.txt
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile('pip-compile --output-file=reqs.txt reqs.in', [
        'foo==1.0.1',
      ]),
    );
    fs.readLocalFile.mockResolvedValueOnce('foo>=1.0.0');
    // absolute/reqs.txt
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile(
        'pip-compile --output-file=./absolute/reqs.txt ./absolute/reqs.in',
        ['foo==1.0.1'],
      ),
    );
    fs.readLocalFile.mockResolvedValueOnce('foo>=1.0.0');
    // relative/reqs.txt
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile(
        'pip-compile --output-file=reqs.txt ../outside.in',
        ['foo==1.0.1'],
      ),
    );
    fs.readLocalFile.mockResolvedValueOnce('foo>=1.0.0');
    const packageFiles = await extractAllPackageFiles({}, [
      'reqs.txt',
      'absolute/reqs.txt',
      'relative/reqs.txt',
    ]);
    expect(packageFiles?.map((p) => p.packageFile).sort()).toEqual(
      ['reqs.in', 'absolute/reqs.in', 'outside.in'].sort(),
    );
    expect(logger.warn).toHaveBeenCalledTimes(0);
  });

  it('return sorted package files', async () => {
    fs.readLocalFile.mockImplementation((name): any => {
      if (name === '1.in') {
        return 'foo';
      } else if (name === '2.txt') {
        return getSimpleRequirementsFile(
          'pip-compile --output-file=2.txt 1.in',
          ['foo==1.0.1'],
        );
      } else if (name === '3.in') {
        return '-r 2.txt\nfoo';
      } else if (name === '4.txt') {
        return getSimpleRequirementsFile(
          'pip-compile --output-file=4.txt 3.in',
          ['foo==1.0.1'],
        );
      }
      return null;
    });

    const lockFiles = ['4.txt', '2.txt'];
    const packageFiles = await extractAllPackageFiles({}, lockFiles);
    expect(packageFiles).toBeDefined();
    expect(packageFiles?.map((p) => p.packageFile)).toEqual(['1.in', '3.in']);
    expect(packageFiles?.map((p) => p.lockFiles)).toEqual([
      ['2.txt', '4.txt'],
      ['4.txt'],
    ]);
  });

  it('return sorted package files with constraint in file', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile('pip-compile --output-file=4.txt 3.in', [
        'foo==1.0.1',
      ]),
    );
    fs.readLocalFile.mockResolvedValueOnce('-c 2.txt\nfoo');
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile('pip-compile --output-file=2.txt 1.in', [
        'foo==1.0.1',
      ]),
    );
    fs.readLocalFile.mockResolvedValueOnce('foo');

    const lockFiles = ['4.txt', '2.txt'];
    const packageFiles = await extractAllPackageFiles({}, lockFiles);
    expect(packageFiles).toBeDefined();
    expect(packageFiles?.map((p) => p.packageFile)).toEqual(['1.in', '3.in']);
    expect(packageFiles?.map((p) => p.lockFiles!.pop())).toEqual([
      '2.txt',
      '4.txt',
    ]);
  });

  it('return sorted package files with constraint in command', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile(
        'pip-compile --constraint=2.txt --output-file=4.txt 3.in',
        ['foo==1.0.1'],
      ),
    );
    fs.readLocalFile.mockResolvedValueOnce('foo');
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile('pip-compile --output-file=2.txt 1.in', [
        'foo==1.0.1',
      ]),
    );
    fs.readLocalFile.mockResolvedValueOnce('foo');

    const lockFiles = ['4.txt', '2.txt'];
    const packageFiles = await extractAllPackageFiles({}, lockFiles);
    expect(packageFiles).toBeDefined();
    expect(packageFiles?.map((p) => p.packageFile)).toEqual(['1.in', '3.in']);
    expect(packageFiles?.map((p) => p.lockFiles!.pop())).toEqual([
      '2.txt',
      '4.txt',
    ]);
  });

  it('adds lockedVersion to deps in package file', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile(
        'pip-compile --output-file=requirements.txt requirements.in',
        ['friendly-bard==1.0.1'],
      ),
    );
    // also check if normalized name is used
    fs.readLocalFile.mockResolvedValueOnce('FrIeNdLy-._.-bArD>=1.0.0');

    const lockFiles = ['requirements.txt'];
    const packageFiles = await extractAllPackageFiles({}, lockFiles);
    expect(packageFiles).toBeDefined();
    const packageFile = packageFiles!.pop();
    expect(packageFile!.deps).toHaveLength(1);
    expect(packageFile!.deps.pop()).toMatchObject({
      currentValue: '>=1.0.0',
      depName: 'FrIeNdLy-._.-bArD',
      lockedVersion: '1.0.1',
    });
  });

  it('warns if dependency has no locked version', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile(
        'pip-compile --output-file=requirements.txt requirements.in',
        ['foo==1.0.1'],
      ),
    );
    fs.readLocalFile.mockResolvedValueOnce('foo>=1.0.0\nbar');

    const lockFiles = ['requirements.txt'];
    const packageFiles = await extractAllPackageFiles({}, lockFiles);
    expect(packageFiles).toBeDefined();
    const packageFile = packageFiles!.pop();
    expect(packageFile!.deps).toHaveLength(2);
    expect(logger.warn).toHaveBeenCalledWith(
      { depName: 'bar', lockFile: 'requirements.txt' },
      'pip-compile: dependency not found in lock file',
    );
  });

  it('adds transitive dependency to deps in package file', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile(
        'pip-compile --output-file=requirements.txt requirements.in',
        ['friendly-bard==1.0.1', 'bards-friend==1.0.0'],
      ),
    );
    fs.readLocalFile.mockResolvedValueOnce('FrIeNdLy-._.-bArD>=1.0.0');

    const lockFiles = ['requirements.txt'];
    const packageFiles = await extractAllPackageFiles({}, lockFiles);
    expect(packageFiles).toBeDefined();
    const packageFile = packageFiles!.pop();
    expect(packageFile!.deps).toHaveLength(2);
    expect(packageFile!.deps[1]).toEqual({
      datasource: 'pypi',
      depType: 'indirect',
      depName: 'bards-friend',
      lockedVersion: '1.0.0',
      enabled: false,
    });
  });

  it('handles -r reference to another input file', async () => {
    fs.readLocalFile.mockImplementation((name): any => {
      if (name === '1.in') {
        return 'foo';
      } else if (name === '2.txt') {
        return getSimpleRequirementsFile(
          'pip-compile --output-file=2.txt 1.in',
          ['foo==1.0.1'],
        );
      } else if (name === '3.in') {
        return '-r 1.in\nfoo';
      } else if (name === '4.txt') {
        return getSimpleRequirementsFile(
          'pip-compile --output-file=4.txt 3.in',
          ['foo==1.0.1'],
        );
      }
      return null;
    });

    const lockFiles = ['4.txt', '2.txt'];
    const packageFiles = await extractAllPackageFiles({}, lockFiles);
    expect(packageFiles?.map((p) => p.lockFiles)).toEqual([
      ['2.txt', '4.txt'],
      ['4.txt'],
    ]);
  });

  it('handles transitive -r references', async () => {
    fs.readLocalFile.mockImplementation((name): any => {
      if (name === '1.in') {
        return 'foo';
      } else if (name === '2.txt') {
        return getSimpleRequirementsFile(
          'pip-compile --output-file=2.txt 1.in',
          ['foo==1.0.1'],
        );
      } else if (name === '3.in') {
        return '-r 1.in\nfoo';
      } else if (name === '4.txt') {
        return getSimpleRequirementsFile(
          'pip-compile --output-file=4.txt 3.in',
          ['foo==1.0.1'],
        );
      } else if (name === '5.in') {
        return '-r 4.txt\nfoo';
      } else if (name === '6.txt') {
        return getSimpleRequirementsFile(
          'pip-compile --output-file=6.txt 5.in',
          ['foo==1.0.1'],
        );
      }
      return null;
    });

    const lockFiles = ['4.txt', '2.txt', '6.txt'];
    const packageFiles = await extractAllPackageFiles({}, lockFiles);
    expect(packageFiles?.map((p) => p.lockFiles)).toEqual([
      ['2.txt', '4.txt', '6.txt'],
      ['4.txt', '6.txt'],
      ['6.txt'],
    ]);
  });

  it('warns on -r reference to failed file', async () => {
    fs.readLocalFile.mockImplementation((name): any => {
      if (name === 'reqs-no-headers.txt') {
        return Fixtures.get('requirementsNoHeaders.txt');
      } else if (name === '1.in') {
        return '-r reqs-no-headers.txt\nfoo';
      } else if (name === '2.txt') {
        return getSimpleRequirementsFile(
          'pip-compile --output-file=2.txt 1.in',
          ['foo==1.0.1'],
        );
      }
      return null;
    });

    const lockFiles = ['reqs-no-headers.txt', '2.txt'];
    const packageFiles = await extractAllPackageFiles({}, lockFiles);
    expect(packageFiles?.map((p) => p.lockFiles)).toEqual([['2.txt']]);
    expect(logger.warn).toHaveBeenCalledWith(
      'pip-compile: 1.in references reqs-no-headers.txt which does not appear to be a requirements file managed by pip-compile',
    );
  });

  it('warns on -r reference to requirements file not managed by pip-compile', async () => {
    fs.readLocalFile.mockImplementation((name): any => {
      if (name === '1.in') {
        return '-r unmanaged-file.txt\nfoo';
      } else if (name === '2.txt') {
        return getSimpleRequirementsFile(
          'pip-compile --output-file=2.txt 1.in',
          ['foo==1.0.1'],
        );
      }
      return null;
    });

    const lockFiles = ['2.txt'];
    const packageFiles = await extractAllPackageFiles({}, lockFiles);
    expect(packageFiles?.map((p) => p.lockFiles)).toEqual([['2.txt']]);
    expect(logger.warn).toHaveBeenCalledWith(
      'pip-compile: 1.in references unmanaged-file.txt which does not appear to be a requirements file managed by pip-compile',
    );
  });
});
