import { vi } from 'vitest';
import { logger } from '../../../logger';
import { updateDependency } from './update';

// Mock the logger
vi.mock('../../../logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

describe('modules/manager/apko/update', () => {
  describe('updateDependency', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return null when depName is missing', () => {
      const result = updateDependency({
        fileContent: 'package=1.0.0',
        upgrade: {
          depName: '',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'Missing required fields for APK update',
      );
    });

    it('should return null when currentValue is missing', () => {
      const result = updateDependency({
        fileContent: 'package=1.0.0',
        upgrade: {
          depName: 'package',
          currentValue: '',
          newValue: '1.0.1',
        },
      });

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'Missing required fields for APK update',
      );
    });

    it('should return null when newValue is missing', () => {
      const result = updateDependency({
        fileContent: 'package=1.0.0',
        upgrade: {
          depName: 'package',
          currentValue: '1.0.0',
          newValue: '',
        },
      });

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'Missing required fields for APK update',
      );
    });

    it('should return null when old package specification is not found', () => {
      const result = updateDependency({
        fileContent: 'other-package=2.0.0',
        upgrade: {
          depName: 'package',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        {
          depName: 'package',
          currentValue: '1.0.0',
          oldPackageSpec: 'package=1.0.0',
        },
        'Could not find package specification to replace',
      );
    });

    it('should return null when no changes are made', () => {
      const result = updateDependency({
        fileContent: 'package=1.0.0',
        upgrade: {
          depName: 'package',
          currentValue: '1.0.0',
          newValue: '1.0.0',
        },
      });

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'No changes made to package file',
      );
    });

    it('should successfully update package version', () => {
      const fileContent = 'package=1.0.0\nother-package=2.0.0';
      const result = updateDependency({
        fileContent,
        upgrade: {
          depName: 'package',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(result).toBe('package=1.0.1\nother-package=2.0.0');
      expect(logger.debug).toHaveBeenCalledWith(
        { depName: 'package', currentValue: '1.0.0', newValue: '1.0.1' },
        'Successfully updated APK package version',
      );
    });

    it('should update the first occurrence of the package', () => {
      const fileContent = 'package=1.0.0\npackage=1.0.0\nother-package=2.0.0';
      const result = updateDependency({
        fileContent,
        upgrade: {
          depName: 'package',
          currentValue: '1.0.0',
          newValue: '1.0.1',
        },
      });

      expect(result).toBe('package=1.0.1\npackage=1.0.0\nother-package=2.0.0');
    });

    it('should handle complex package specifications', () => {
      const fileContent = 'complex-package-name=1.2.3-r0\nother-package=2.0.0';
      const result = updateDependency({
        fileContent,
        upgrade: {
          depName: 'complex-package-name',
          currentValue: '1.2.3-r0',
          newValue: '1.2.4-r0',
        },
      });

      expect(result).toBe('complex-package-name=1.2.4-r0\nother-package=2.0.0');
    });

    it('should return null when no changes are made in main path', () => {
      const yamlContent = `contents:
  packages:
    - git=2.51.1
    - bash=5.2.37-r0
archs:
  - x86_64`;

      const result = updateDependency({
        fileContent: yamlContent,
        upgrade: {
          depName: 'git',
          currentValue: '2.51.1',
          newValue: '2.51.1',
        },
      });

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'No changes made to package file',
      );
    });

    it('should update exact versions with rangeStrategy specified', () => {
      const yamlContent = `contents:
  packages:
    - git=2.50.0
    - bash=5.2.37-r0
archs:
  - x86_64`;

      const result = updateDependency({
        fileContent: yamlContent,
        upgrade: {
          depName: 'bash',
          currentValue: '5.2.37-r0',
          newValue: '5.3-r3',
          rangeStrategy: 'update-lockfile',
        },
      });

      expect(result).toBe(`contents:
  packages:
    - git=2.50.0
    - bash=5.3-r3
archs:
  - x86_64`);
    });

    it('should use new version when current version has no revision (versioning API handles stripping)', () => {
      const yamlContent = `contents:
  packages:
    - git=2.50.0
    - bash=5.2.37-r0
archs:
  - x86_64`;

      const result = updateDependency({
        fileContent: yamlContent,
        upgrade: {
          depName: 'git',
          currentValue: '2.50.0',
          newValue: '2.51.1', // Revision already stripped by versioning API
        },
      });

      expect(result).toBe(`contents:
  packages:
    - git=2.51.1
    - bash=5.2.37-r0
archs:
  - x86_64`);
    });

    it('should keep revision in new version when current version has revision', () => {
      const yamlContent = `contents:
  packages:
    - git=2.50.0-r0
    - bash=5.2.37-r0
archs:
  - x86_64`;

      const result = updateDependency({
        fileContent: yamlContent,
        upgrade: {
          depName: 'git',
          currentValue: '2.50.0-r0',
          newValue: '2.51.1-r1', // Versioning API preserves revision when current has it
        },
      });

      expect(result).toBe(`contents:
  packages:
    - git=2.51.1-r1
    - bash=5.2.37-r0
archs:
  - x86_64`);
    });
  });
});
