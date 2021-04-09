import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { extractPackageFile } from '.';

const input = readFileSync(
  resolve(__dirname, `./__fixtures__/sample.txt`),
  'utf8'
);

describe('manager/cdnurl/extract', () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(input)).toMatchSnapshot();
  });
});
