import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from '../../../lib/manager/cdn/extract';

const input = readFileSync(
  resolve(__dirname, `./_fixtures/sample.html`),
  'utf8'
);

describe('manager/cdn/extract', () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(input)).toMatchSnapshot();
  });
});
