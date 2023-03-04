import { extractPackageFile } from '.';

// TODO
describe('modules/manager/bicep/extract', () => {
  test.each``('', () => {
    const res = extractPackageFile('', '', {});
    expect(res).toBeNull();
  });
});
