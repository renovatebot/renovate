import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

describe('modules/manager/tox/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts dependencies', () => {
      const res = extractPackageFile(Fixtures.get('tox-ini-1.txt'));
      expect(res).toMatchSnapshot({
        deps: [
          { depName: 'base-test-env', currentValue: '==1.0.0' },
          { depName: 'basic1', currentValue: '>=3.1.24' },
          { depName: 'basic2', currentValue: '>=21.3' },
          { depName: 'basic3', currentValue: '<=21.3' },
          { depName: 'basic4', currentValue: '<1.0.0' },
          { depName: 'basic5', currentValue: '>1.0.0' },
          { depName: 'basic6', currentValue: '==1.0.0' },
          { depName: 'basic7', currentValue: '~=1.0.0' },
          { depName: 'single-line', currentValue: '>=2.9.3' },
          { depName: 'comment-deps1', currentValue: '>=2.16' },
          { depName: 'equals1', currentValue: '>=1.19.4' },
          { depName: 'dep-combos1', currentValue: undefined },
          { depName: 'dep-combos2', currentValue: '==1.0.0' },
        ],
      });
    });
  });
});
