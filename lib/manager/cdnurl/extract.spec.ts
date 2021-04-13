import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { getName } from '../../../test/util';
import { extractPackageFile } from '.';

const input = readFileSync(
  resolve(__dirname, `./__fixtures__/sample.txt`),
  'utf8'
);

describe(getName(__filename), () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(input)).toMatchSnapshot();
  });
});
