import { Fixtures } from '../../../../test/fixtures';
import type { ExtractConfig } from '../types';
import { extractPackageFile } from '.';

const packageFile = 'setup.py';

const config: ExtractConfig = {};

describe('modules/manager/pip_setup/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns found deps', () => {
      const content = Fixtures.get(packageFile);

      expect(extractPackageFile(content, packageFile, config)).toMatchSnapshot({
        deps: [
          { depName: 'celery', currentValue: '>=3.1.13.0,<5.0' },
          { depName: 'logging_tree', currentValue: '>=1.7' },
          { depName: 'pygments', currentValue: '>=2.2' },
          { depName: 'psutil', currentValue: '>=5.0' },
          { depName: 'objgraph', currentValue: '>=3.0' },
          { depName: 'django', currentValue: '>=1.11.23,<2.0' },
          { depName: 'flask', currentValue: '>=0.11,<2.0' },
          { depName: 'blinker', currentValue: '>=1.4,<2.0' },
          { depName: 'gunicorn', currentValue: '>=19.7.0,<20.0' },
          { depName: 'Werkzeug', currentValue: '>=0.15.3,<0.16' },
          { depName: 'statsd', currentValue: '>=3.2.1,<4.0' },
          {
            depName: 'requests',
            currentValue: '>=2.10.0,<3.0',
            skipReason: 'ignored',
          },
          { depName: 'raven', currentValue: '>=5.27.1,<7.0' },
          { depName: 'future', currentValue: '>=0.15.2,<0.17' },
          { depName: 'ipaddress', currentValue: '>=1.0.16,<2.0' },
          { depName: 'zope.interface', currentValue: '>=5.5.2,<6.0.0' },
        ],
      });
    });

    it('returns nothing', () => {
      expect(extractPackageFile('', packageFile, config)).toBeNull();
    });
  });
});
