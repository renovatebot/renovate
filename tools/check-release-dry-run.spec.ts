import {
  type DryRunResultLike,
  evaluateResult,
} from './check-release-dry-run.ts';

function result(
  nextType: string | null,
  version = '0.0.0',
  lastVersion: string | null = '44.0.0',
): DryRunResultLike | false {
  return {
    nextRelease: nextType ? { type: nextType, version } : null,
    lastRelease: lastVersion ? { version: lastVersion } : null,
  };
}

describe('tools/check-release-dry-run', () => {
  describe('evaluateResult', () => {
    it('flags a major release', () => {
      expect(evaluateResult(result('major', '45.0.0'))).toEqual({
        willRelease: true,
        type: 'major',
        version: '45.0.0',
        lastVersion: '44.0.0',
        isMajor: true,
      });
    });

    it('flags a premajor release (next prerelease branch)', () => {
      expect(evaluateResult(result('premajor', '45.0.0-next.1'))).toMatchObject(
        {
          isMajor: true,
        },
      );
    });

    it('does not flag a minor release', () => {
      expect(evaluateResult(result('minor', '44.1.0'))).toMatchObject({
        isMajor: false,
        type: 'minor',
      });
    });

    it('does not flag a patch release', () => {
      expect(evaluateResult(result('patch', '44.0.1'))).toMatchObject({
        isMajor: false,
      });
    });

    it('handles no release (result is false)', () => {
      expect(evaluateResult(false)).toEqual({
        willRelease: false,
        type: null,
        version: null,
        lastVersion: null,
        isMajor: false,
      });
    });

    it('handles no release (no nextRelease)', () => {
      expect(evaluateResult(result(null))).toMatchObject({
        willRelease: false,
        isMajor: false,
      });
    });
  });
});
