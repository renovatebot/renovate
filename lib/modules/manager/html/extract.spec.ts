import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

const sample = Fixtures.get(`sample.html`);
const nothing = Fixtures.get(`nothing.html`);

describe('modules/manager/html/extract', () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(sample)).toMatchInlineSnapshot(
      {
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
            currentDigest:
              'sha256-mpnrJ5DpEZZkwkE1ZgkEQQJW/46CSEh/STrZKOB/qoM=',
          },
        ],
      },
      `
      {
        "deps": [
          {
            "currentValue": "15.6.1",
            "datasource": "cdnjs",
            "depName": "prop-types",
            "packageName": "prop-types/prop-types.min.js",
            "replaceString": "<script type="text/javascript"
                  src="https://cdnjs.cloudflare.com/ajax/libs/prop-types/15.6.1/prop-types.min.js">",
          },
          {
            "currentValue": "16.3.2",
            "datasource": "cdnjs",
            "depName": "react",
            "packageName": "react/umd/react.production.min.js",
            "replaceString": "<script type="text/javascript"
                  src="https://cdnjs.cloudflare.com/ajax/libs/react/16.3.2/umd/react.production.min.js">",
          },
          {
            "currentValue": "16.3.2",
            "datasource": "cdnjs",
            "depName": "react-dom",
            "packageName": "react-dom/umd/react-dom.production.min.js",
            "replaceString": "<script type="text/javascript"
                  src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/16.3.2/umd/react-dom.production.min.js">",
          },
          {
            "currentValue": "2.2.1",
            "datasource": "cdnjs",
            "depName": "react-transition-group",
            "packageName": "react-transition-group/react-transition-group.min.js",
            "replaceString": "<script type="text/javascript"
                  src="https://cdnjs.cloudflare.com/ajax/libs/react-transition-group/2.2.1/react-transition-group.min.js">",
          },
          {
            "currentValue": "1.14.3",
            "datasource": "cdnjs",
            "depName": "popper.js",
            "packageName": "popper.js/umd/popper.min.js",
            "replaceString": "<script type="text/javascript"
                  src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.3/umd/popper.min.js">",
          },
          {
            "currentValue": "0.10.4",
            "datasource": "cdnjs",
            "depName": "react-popper",
            "packageName": "react-popper/umd/react-popper.min.js",
            "replaceString": "<script type="text/javascript"
                  src="https://cdnjs.cloudflare.com/ajax/libs/react-popper/0.10.4/umd/react-popper.min.js">",
          },
          {
            "currentValue": "7.1.0",
            "datasource": "cdnjs",
            "depName": "reactstrap",
            "packageName": "reactstrap/reactstrap.min.js",
            "replaceString": "<script src="https://cdnjs.cloudflare.com/ajax/libs/reactstrap/7.1.0/reactstrap.min.js">",
          },
          {
            "currentValue": "4.3.1",
            "datasource": "cdnjs",
            "depName": "react-router",
            "packageName": "react-router/react-router.min.js",
            "replaceString": "<script src=" https://cdnjs.cloudflare.com/ajax/libs/react-router/4.3.1/react-router.min.js">",
          },
          {
            "currentValue": "4.0.6",
            "datasource": "cdnjs",
            "depName": "react-markdown",
            "packageName": "react-markdown/react-markdown.js",
            "replaceString": "<script src="https://cdnjs.cloudflare.com/ajax/libs/react-markdown/4.0.6/react-markdown.js">",
          },
          {
            "currentDigest": "sha256-mpnrJ5DpEZZkwkE1ZgkEQQJW/46CSEh/STrZKOB/qoM=",
            "currentValue": "0.18.0",
            "datasource": "cdnjs",
            "depName": "axios",
            "packageName": "axios/axios.min.js",
            "replaceString": "<script src="https://cdnjs.cloudflare.com/ajax/libs/axios/0.18.0/axios.min.js"
                  integrity="sha256-mpnrJ5DpEZZkwkE1ZgkEQQJW/46CSEh/STrZKOB/qoM=" crossorigin="anonymous">",
          },
        ],
      }
    `,
    );
  });

  it('returns null', () => {
    expect(extractPackageFile(nothing)).toBeNull();
  });
});
