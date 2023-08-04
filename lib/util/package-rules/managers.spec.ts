import { ManagersMatcher } from './managers';

describe('util/package-rules/managers', () => {
  const managersMatcher = new ManagersMatcher();

  describe('match', () => {
    it('should not match against custom manager when matchManager=custom', () => {
      const result = managersMatcher.matches(
        {
          manager: 'custom.regex',
        },
        {
          matchManagers: ['custom'],
        }
      );
      expect(result).toBeFalse();
    });

    it('should match custom managers separately', () => {
      const result = managersMatcher.matches(
        {
          manager: 'custom.regex',
        },
        {
          matchManagers: ['custom.regex'],
        }
      );
      expect(result).toBeTrue();
    });

    it('should return true', () => {
      const result = managersMatcher.matches(
        {
          manager: 'npm',
        },
        {
          matchManagers: ['npm', 'custom.regex'],
        }
      );
      expect(result).toBeTrue();
    });

    it('should return false for no match', () => {
      const result = managersMatcher.matches(
        {
          manager: 'npm',
        },
        {
          matchManagers: ['custom'],
        }
      );
      expect(result).toBeFalse();
    });

    it('should return null if matchManagers is undefined', () => {
      const result = managersMatcher.matches(
        {
          manager: 'npm',
        },
        {}
      );
      expect(result).toBeNull();
    });

    it('should return false if no manager', () => {
      const result = managersMatcher.matches(
        {},
        {
          matchManagers: ['npm'],
        }
      );
      expect(result).toBeFalse();
    });
  });
});
