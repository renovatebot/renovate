import { ManagersMatcher } from './managers';

describe('util/package-rules/managers', () => {
  const managersMatcher = new ManagersMatcher();

  describe('match', () => {
    it('should return true', () => {
      const result = managersMatcher.matches(
        {
          manager: 'npm',
        },
        {
          matchManagers: ['npm', 'regex'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should return false for no match', () => {
      const result = managersMatcher.matches(
        {
          manager: 'npm',
        },
        {
          matchManagers: ['docker'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return null if matchManagers is undefined', () => {
      const result = managersMatcher.matches(
        {
          manager: 'npm',
        },
        {},
      );
      expect(result).toBeNull();
    });

    it('should return false if no manager', () => {
      const result = managersMatcher.matches(
        {},
        {
          matchManagers: ['npm'],
        },
      );
      expect(result).toBeFalse();
    });
  });
});
