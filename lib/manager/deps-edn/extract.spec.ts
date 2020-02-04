/* eslint-disable no-template-curly-in-string */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from './extract';

const depsEdn = readFileSync(
  resolve(__dirname, `./_fixtures__/deps.edn`),
  'utf8'
);

describe('manager/deps-edn/extract', () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(depsEdn)).toMatchSnapshot();
  });
});
