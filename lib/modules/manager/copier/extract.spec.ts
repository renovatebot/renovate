import { codeBlock } from 'common-tags';
import { extractPackageFile } from './index.ts';

describe('modules/manager/copier/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts repository and version from .copier-answers.yml', () => {
      const content = `
        _commit: v1.0.0
        _src_path: https://github.com/username/template-repo
      `;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName: 'https://github.com/username/template-repo',
            packageName: 'https://github.com/username/template-repo',
            currentValue: 'v1.0.0',
            datasource: 'git-tags',
            depType: 'template',
          },
        ],
      });
    });

    it('converts ssh URL to https packageName', () => {
      const content = `
        _commit: v1.0.0
        _src_path: git@github.com:renovatebot/somedir/renovate.git
      `;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName: 'git@github.com:renovatebot/somedir/renovate.git',
            packageName: 'https://github.com/renovatebot/somedir/renovate.git',
            currentValue: 'v1.0.0',
            datasource: 'git-tags',
            depType: 'template',
          },
        ],
      });
    });

    it('converts ssh URL of a non-bare Repo to https packageName', () => {
      const content = `
        _commit: v1.0.0
        _src_path: git@some-scm-server.tld:renovatebot/somedir/renovate
      `;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName: 'git@some-scm-server.tld:renovatebot/somedir/renovate',
            packageName:
              'https://some-scm-server.tld/renovatebot/somedir/renovate',
            currentValue: 'v1.0.0',
            datasource: 'git-tags',
            depType: 'template',
          },
        ],
      });
    });

    it('converts ssh URL with a username different from git to https packageName', () => {
      const content = `
        _commit: v1.0.0
        _src_path: someuser@some-scm-server.tld:renovatebot/somedir/renovate.git
      `;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName:
              'someuser@some-scm-server.tld:renovatebot/somedir/renovate.git',
            packageName:
              'https://some-scm-server.tld/renovatebot/somedir/renovate.git',
            currentValue: 'v1.0.0',
            datasource: 'git-tags',
            depType: 'template',
          },
        ],
      });
    });

    it('keeps the original packageName if the URL cannot be converted', () => {
      const content = `
        _commit: v1.0.0
        _src_path: user@:renovatebot/renovate.git
      `;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName: 'user@:renovatebot/renovate.git',
            packageName: 'user@:renovatebot/renovate.git',
            currentValue: 'v1.0.0',
            datasource: 'git-tags',
            depType: 'template',
          },
        ],
      });
    });

    it.each([
      {
        srcPath:
          'git+https://bitbucket.some-org/scm/some-project/some-template.git',
        expectedPackageName:
          'https://bitbucket.some-org/scm/some-project/some-template.git',
      },
      {
        srcPath:
          'git+ssh://git@bitbucket.some-org/some-project/some-template.git',
        expectedPackageName:
          'https://bitbucket.some-org/scm/some-project/some-template.git',
      },
      {
        srcPath: 'git+ssh://git@gitlab.com/some-org/some-template.git',
        expectedPackageName: 'https://gitlab.com/some-org/some-template.git',
      },
      {
        srcPath: 'ssh://git@gitlab.com/some-org/some-template.git',
        expectedPackageName: 'https://gitlab.com/some-org/some-template.git',
      },
    ])(
      'strips git+ prefix and converts ssh to https for $srcPath',
      ({ srcPath, expectedPackageName }) => {
        const content = codeBlock`
          _commit: v1.0.0
          _src_path: ${srcPath}
        `;
        const result = extractPackageFile(content);
        expect(result).toEqual({
          deps: [
            {
              depName: srcPath,
              packageName: expectedPackageName,
              currentValue: 'v1.0.0',
              datasource: 'git-tags',
              depType: 'template',
            },
          ],
        });
      },
    );

    it('returns null for invalid .copier-answers.yml', () => {
      const content = `
        not_valid:
          key: value
      `;
      const result = extractPackageFile(content);
      expect(result).toBeNull();
    });

    it('returns null for invalid _src_path', () => {
      const content = `
        _commit: v1.0.0
        _src_path: notaurl
      `;
      const result = extractPackageFile(content);
      expect(result).toBeNull();
    });

    it('returns null for missing _commit field', () => {
      const content = `
        _src_path: https://github.com/username/template-repo
      `;
      const result = extractPackageFile(content);
      expect(result).toBeNull();
    });

    it('returns null for missing _src_path field', () => {
      const content = `
        _commit: v1.0.0
      `;
      const result = extractPackageFile(content);
      expect(result).toBeNull();
    });
  });
});
