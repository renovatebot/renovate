import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from '.';

const input = readFileSync(
  resolve(__dirname, `./__fixtures__/sample.html`),
  'utf8'
);

describe('manager/html/extract', () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(input)).toMatchSnapshot();
  });
});
