import { codeBlock } from 'common-tags';
import { extractPackageFile } from './extract';

describe('modules/manager/devbox-version/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts version', () => {
      const content = codeBlock`
        0.16.0
      `;
      const res = extractPackageFile(content);
      expect(res.deps).toEqual([
        {
          depName: 'devbox',
          currentValue: '0.16.0',
          datasource: 'devbox-version',
        },
      ]);
    });

    it('extracts version with extra whitespace', () => {
      const content = '  0.16.0  \n';
      const res = extractPackageFile(content);
      expect(res.deps).toEqual([
        {
          depName: 'devbox',
          currentValue: '0.16.0',
          datasource: 'devbox-version',
        },
      ]);
    });

    it('extracts pre-release version', () => {
      const content = codeBlock`
        0.17.0-beta.1
      `;
      const res = extractPackageFile(content);
      expect(res.deps).toEqual([
        {
          depName: 'devbox',
          currentValue: '0.17.0-beta.1',
          datasource: 'devbox-version',
        },
      ]);
    });

    it('extracts empty file', () => {
      const content = '';
      const res = extractPackageFile(content);
      expect(res.deps).toEqual([
        {
          depName: 'devbox',
          currentValue: '',
          datasource: 'devbox-version',
        },
      ]);
    });
  });
});
