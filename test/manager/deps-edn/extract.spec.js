/* eslint-disable no-template-curly-in-string */
const fs = require('fs');
const path = require('path');
const { extractPackageFile } = require('../../../lib/manager/deps-edn/extract');

const depsEdn = fs.readFileSync(
  path.resolve(__dirname, `./_fixtures/deps.edn`),
  'utf8'
);

describe('manager/deps-edn/extract', () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(depsEdn)).toMatchSnapshot();
  });
});
