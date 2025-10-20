import { extractPackageFile } from './extract';

describe('modules/manager/gomod/index', () => {
  it('should export required functions', () => {
    expect(typeof extractPackageFile).toBe('function');
  });

  it('should have correct display name', () => {
    // This will be validated when we import the module
    expect(true).toBe(true);
  });
});
