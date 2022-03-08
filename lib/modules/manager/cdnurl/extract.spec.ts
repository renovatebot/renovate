import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

describe('modules/manager/cdnurl/extract', () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(Fixtures.get(`sample.txt`))).toMatchSnapshot({
      deps: [
        {
          depName: 'prop-types',
          currentValue: '15.6.1',
          packageName: 'prop-types/prop-types.min.js',
        },
        { depName: 'react', currentValue: '16.3.2' },
        { depName: 'react-dom', currentValue: '16.3.2' },
        { depName: 'react-transition-group', currentValue: '2.2.1' },
        { depName: 'popper.js', currentValue: '1.14.3' },
        { depName: 'react-popper', currentValue: '0.10.4' },
        { depName: 'reactstrap', currentValue: '7.1.0' },
        { depName: 'react-router', currentValue: '4.3.1' },
        { depName: 'react-markdown', currentValue: '4.0.6' },
        { depName: 'axios', currentValue: '0.18.0' },
      ],
    });
  });
});
