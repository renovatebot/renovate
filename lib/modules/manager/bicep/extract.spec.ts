import { extractPackageFile } from '.';

describe('modules/manager/bicep/extract', () => {
  test.each``('', () => {
    const res = extractPackageFile('', '', {});
    expect(res).toBeNull();
  });
});
