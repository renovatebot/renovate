import { getRoleAccessLevel } from './roles.ts';

describe('modules/platform/gitlab/roles', () => {
  describe('getRoleAccessLevel', () => {
    it.each`
      handle                | expected
      ${'@@no_access'}      | ${0}
      ${'@@minimal_access'} | ${5}
      ${'@@guest'}          | ${10}
      ${'@@planner'}        | ${15}
      ${'@@reporter'}       | ${20}
      ${'@@developer'}      | ${30}
      ${'@@maintainer'}     | ${40}
      ${'@@owner'}          | ${50}
    `('resolves $handle to $expected', ({ handle, expected }) => {
      expect(getRoleAccessLevel(handle)).toBe(expected);
    });

    it('is case-insensitive', () => {
      expect(getRoleAccessLevel('@@Maintainer')).toBe(40);
      expect(getRoleAccessLevel('@@OWNER')).toBe(50);
    });

    it.each`
      handle
      ${'@developer'}
      ${'@@unknown'}
      ${'developer'}
      ${'@@'}
      ${'@group'}
      ${'u@email.com'}
    `('returns null for $handle', ({ handle }) => {
      expect(getRoleAccessLevel(handle)).toBeNull();
    });
  });
});
