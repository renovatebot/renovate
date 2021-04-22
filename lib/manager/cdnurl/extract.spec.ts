import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { testName } from '../../../test/util';
import { extractPackageFile } from '.';

const input = readFileSync(
  resolve(__dirname, `./__fixtures__/sample.txt`),
  'utf8'
);

describe(testName(), () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(input)).toMatchSnapshot();
  });
});
