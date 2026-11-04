import { ManagersMatcher } from './managers.ts';

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

    it('should match custom managers', () => {
      const result = managersMatcher.matches(
        {
          manager: 'regex',
        },
        {
          matchManagers: ['custom.regex'],
        },
      );
      expect(result).toBeTrue();
    });

    describe('named custom managers', () => {
      const named = { manager: 'regex', customName: 'dockerfile-versions' };

      it.each`
        matchManagers                                            | expected
        ${['custom.regex.dockerfile-versions']}                  | ${true}
        ${['custom.regex']}                                      | ${true}
        ${['custom.regex.*']}                                    | ${true}
        ${['custom.*']}                                          | ${true}
        ${['custom.regex.other']}                                | ${false}
        ${['custom.jsonata.dockerfile-versions']}                | ${false}
        ${['custom.jsonata']}                                    | ${false}
        ${['regex']}                                             | ${false}
        ${['!custom.regex']}                                     | ${false}
        ${['!custom.regex.dockerfile-versions']}                 | ${false}
        ${['!custom.regex.other']}                               | ${true}
        ${['custom.regex', '!custom.regex.dockerfile-versions']} | ${false}
        ${['/^custom\\.regex\\.dockerfile-/']}                   | ${true}
      `(
        'matchManagers=$matchManagers returns $expected',
        ({ matchManagers, expected }) => {
          expect(managersMatcher.matches(named, { matchManagers })).toBe(
            expected,
          );
        },
      );

      it('does not match a name pattern for an unnamed custom manager', () => {
        const result = managersMatcher.matches(
          { manager: 'regex' },
          { matchManagers: ['custom.regex.dockerfile-versions'] },
        );
        expect(result).toBeFalse();
      });

      it('ignores customName for built-in managers', () => {
        const result = managersMatcher.matches(
          { manager: 'npm', customName: 'foo' },
          { matchManagers: ['npm'] },
        );
        expect(result).toBeTrue();
      });
    });
  });
});
