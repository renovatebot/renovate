import { extractPackageFile } from '.';

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
