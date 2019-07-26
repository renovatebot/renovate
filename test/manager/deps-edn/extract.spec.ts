/* eslint-disable no-template-curly-in-string */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from '../../../lib/manager/deps-edn/extract';

const depsEdn = readFileSync(
  resolve(__dirname, `./_fixtures/deps.edn`),
  'utf8'
);

describe('manager/deps-edn/extract', () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(depsEdn)).toMatchSnapshot();
  });
});
