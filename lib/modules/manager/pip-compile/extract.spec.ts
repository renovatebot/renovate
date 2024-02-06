import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import { extractAllPackageFiles, extractPackageFile } from './extract';

jest.mock('../../../util/fs');

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
  describe('extractPackageFile()', () => {
    it('returns object for requirements.in', () => {
      expect(
        extractPackageFile(
          Fixtures.get('requirementsWithHashes.txt'),
          'requirements.in',
          {},
        ),
      ).toBeObject();
    });

    it.each([
      'random.py',
      'app.cfg',
      'already_locked.txt',
      // TODO(not7cd)
      'pyproject.toml',
      'setup.py',
      'setup.cfg',
    ])('returns null on not supported package files', (file: string) => {
      expect(extractPackageFile('some content', file, {})).toBeNull();
    });
  });

  describe('extractAllPackageFiles()', () => {
    it('support package file with multiple lock files', () => {
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
      return extractAllPackageFiles({}, lockFiles).then((packageFiles) => {
        expect(packageFiles).not.toBeNull();
        return expect(packageFiles[0]).toHaveProperty('lockFiles', lockFiles);
      });
    });

    it('no lock files in returned package files', () => {
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
      return extractAllPackageFiles({}, lockFiles).then((packageFiles) => {
        return packageFiles.forEach((packageFile) => {
          expect(packageFile).not.toHaveProperty('packageFile', 'foo.txt');
        });
      });
    });
  });

  it('return nothing for malformed files', () => {
    fs.readLocalFile.mockResolvedValueOnce('');
    fs.readLocalFile.mockResolvedValueOnce(
      Fixtures.get('requirementsNoHeaders.txt'),
    );
    fs.readLocalFile.mockResolvedValueOnce(
      getSimpleRequirementsFile(
        'pip-compile --output-file=foo.txt malformed.in empty.in',
        ['foo==1.0.1'],
      ),
    );
    fs.readLocalFile.mockResolvedValueOnce('!@#$');
    fs.readLocalFile.mockResolvedValueOnce('');

    const lockFiles = ['empty.txt', 'noHeader.txt', 'badSource.txt'];
    return extractAllPackageFiles({}, lockFiles).then((packageFiles) => {
      return expect(packageFiles).toBeEmptyArray();
    });
  });
});
