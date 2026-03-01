import { codeBlock } from 'common-tags';
import { extractPep723 } from './utils.ts';

describe('modules/manager/pep723/utils', () => {
  describe('parsePep723()', () => {
    it('should extract dependencies', () => {
      const res = extractPep723(
        codeBlock`
          # /// script
          # requires-python = ">=3.11"
          # dependencies = [
          #   "requests==2.32.3",
          #   "rich>=13.8.0",
          # ]
          # ///
        `,
        'foo.py',
      );

      expect(res).toEqual({
        deps: [
          {
            currentValue: '==2.32.3',
            currentVersion: '2.32.3',
            datasource: 'pypi',
            depName: 'requests',
            depType: 'project.dependencies',
            packageName: 'requests',
          },
          {
            currentValue: '>=13.8.0',
            datasource: 'pypi',
            depName: 'rich',
            depType: 'project.dependencies',
            packageName: 'rich',
          },
        ],
        extractedConstraints: { python: '>=3.11' },
      });
    });

    it('should skip invalid dependencies', () => {
      const res = extractPep723(
        codeBlock`
          # /// script
          # requires-python = "==3.11"
          # dependencies = [
          #   "requests==2.32.3",
          #   "==1.2.3",
          # ]
          # ///
        `,
        'foo.py',
      );

      expect(res).toEqual({
        deps: [
          {
            currentValue: '==2.32.3',
            currentVersion: '2.32.3',
            datasource: 'pypi',
            depName: 'requests',
            depType: 'project.dependencies',
            packageName: 'requests',
          },
        ],
        extractedConstraints: { python: '==3.11' },
      });
    });

    it('should return null on missing dependencies', () => {
      const res = extractPep723(
        codeBlock`
          # /// script
          # requires-python = ">=3.11"
          # ///
        `,
        'foo.py',
      );

      expect(res).toBeNull();
    });

    it('should return null on invalid TOML', () => {
      const res = extractPep723(
        codeBlock`
          # /// script
          # requires-python
          # dependencies = [
          #   "requests==2.32.3",
          #   "rich>=13.8.0",
          # ]
          # ///
        `,
        'foo.py',
      );

      expect(res).toBeNull();
    });

    it('should return null if there is no PEP 723 metadata', () => {
      const res = extractPep723(
        codeBlock`
          if True:
              print("requires-python>=3.11")
        `,
        'foo.py',
      );

      expect(res).toBeNull();
    });
  });
});
