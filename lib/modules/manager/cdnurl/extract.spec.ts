import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/cdnurl/extract', () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(Fixtures.get(`sample.txt`))).toMatchObject({
      deps: [
        {
          currentValue: '15.6.1',
          depName: 'prop-types',
          packageName: 'prop-types/prop-types.min.js',
        },
        {
          currentValue: '16.3.2',
          depName: 'react',
          packageName: 'react/umd/react.production.min.js',
        },
        {
          currentValue: '16.3.2',
          depName: 'react-dom',
          packageName: 'react-dom/umd/react-dom.production.min.js',
        },
        {
          currentValue: '2.2.1',
          depName: 'react-transition-group',
          packageName: 'react-transition-group/react-transition-group.min.js',
        },
        {
          currentValue: '1.14.3',
          depName: 'popper.js',
          packageName: 'popper.js/umd/popper.min.js',
        },
        {
          currentValue: '0.10.4',
          depName: 'react-popper',
          packageName: 'react-popper/umd/react-popper.min.js',
        },
        {
          currentValue: '7.1.0',
          depName: 'reactstrap',
          packageName: 'reactstrap/reactstrap.min.js',
        },
        {
          currentValue: '4.3.1',
          depName: 'react-router',
          packageName: 'react-router/react-router.min.js',
        },
        {
          currentValue: '4.0.6',
          depName: 'react-markdown',
          packageName: 'react-markdown/react-markdown.js',
        },
        {
          currentValue: '0.18.0',
          depName: 'axios',
          packageName: 'axios/axios.min.js',
        },
      ],
    });
  });
});
