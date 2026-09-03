import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

const sample = Fixtures.get(`sample.html`);
const nothing = Fixtures.get(`nothing.html`);

describe('modules/manager/html/extract', () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(sample)).toMatchSnapshot({
      deps: [
        { depName: 'prop-types', currentValue: '15.6.1' },
        { depName: 'react', currentValue: '16.3.2' },
        { depName: 'react-dom', currentValue: '16.3.2' },
        { depName: 'react-transition-group', currentValue: '2.2.1' },
        { depName: 'popper.js', currentValue: '1.14.3' },
        { depName: 'react-popper', currentValue: '0.10.4' },
        { depName: 'reactstrap', currentValue: '7.1.0' },
        { depName: 'react-router', currentValue: '4.3.1' },
        { depName: 'react-markdown', currentValue: '4.0.6' },
        {
          depName: 'axios',
          currentValue: '0.18.0',
          currentDigest: 'sha256-mpnrJ5DpEZZkwkE1ZgkEQQJW/46CSEh/STrZKOB/qoM=',
        },
      ],
    });
  });

  it('extracts unpkg dependencies', () => {
    const content = `
      <script src="https://unpkg.com/babel-standalone@6.26.0/babel.js"></script>
      <script src="https://unpkg.com/@popperjs/core@2.11.8/dist/umd/popper.min.js"></script>
      <link href="https://unpkg.com/react@18.3.1/umd/react.production.min.js" />
    `;

    expect(extractPackageFile(content)).toEqual({
      deps: [
        {
          datasource: 'unpkg',
          depName: 'babel-standalone',
          packageName: 'babel-standalone',
          currentValue: '6.26.0',
          replaceString:
            '<script src="https://unpkg.com/babel-standalone@6.26.0/babel.js">',
        },
        {
          datasource: 'unpkg',
          depName: '@popperjs/core',
          packageName: '@popperjs/core',
          currentValue: '2.11.8',
          replaceString:
            '<script src="https://unpkg.com/@popperjs/core@2.11.8/dist/umd/popper.min.js">',
        },
        {
          datasource: 'unpkg',
          depName: 'react',
          packageName: 'react',
          currentValue: '18.3.1',
          replaceString:
            '<link href="https://unpkg.com/react@18.3.1/umd/react.production.min.js" />',
        },
      ],
    });
  });

  it('returns null', () => {
    expect(extractPackageFile(nothing)).toBeNull();
  });
});
