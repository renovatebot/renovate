import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from '../../../lib/manager/cdnurl';

const input = readFileSync(
  resolve(__dirname, `./_fixtures/sample.txt`),
  'utf8'
);

describe('manager/cdnurl/extract', () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(input)).toMatchSnapshot();
  });
});
