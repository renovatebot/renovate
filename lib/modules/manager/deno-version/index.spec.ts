import { extractPackageFile } from '.';

describe('modules/manager/deno-version/index', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('2.2.4\n');
      expect(res?.deps).toEqual([
        {
          depName: 'Deno',
          packageName: 'deno',
          currentValue: '2.2.4',
          datasource: 'npm',
        },
      ]);
    });

    it('handles empty files', () => {
      const res = extractPackageFile('');
      expect(res).toBeNull();
    });

    it('handles no newline at the end', () => {
      const res = extractPackageFile('2.2.4');
      expect(res).not.toBeNull();
    });

    it('handles multiple lines', () => {
      const res = extractPackageFile('2.2.4\n2.2.5\n');
      expect(res).toBeNull();
    });

    it('handles invalid versions', () => {
      const res = extractPackageFile('notaversion\n');
      expect(res?.deps).toEqual([
        {
          depName: 'Deno',
          packageName: 'deno',
          currentValue: 'notaversion',
          datasource: 'npm',
          skipReason: 'invalid-version',
        },
      ]);
    });

    it('handles ranges', () => {
      const res = extractPackageFile('2.0\n');
      expect(res?.deps).toEqual([
        {
          depName: 'Deno',
          packageName: 'deno',
          currentValue: '2.0',
          datasource: 'npm',
        },
      ]);
    });
  });
});
