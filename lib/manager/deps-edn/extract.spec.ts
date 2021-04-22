/* eslint-disable no-template-curly-in-string */
import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { testName } from '../../../test/util';
import { extractPackageFile } from './extract';

const depsEdn = readFileSync(
  resolve(__dirname, `./__fixtures__/deps.edn`),
  'utf8'
);

describe(testName(), () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(depsEdn)).toMatchSnapshot();
  });
});
