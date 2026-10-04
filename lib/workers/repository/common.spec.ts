import { DEBUG, ERROR, FATAL, INFO, TRACE, WARN } from 'bunyan';
import type { PackageDependency } from '../../modules/manager/types.ts';
import { formatProblemLevel, replacementAlreadyExists } from './common.ts';

describe('workers/repository/common', () => {
  describe('replacementAlreadyExists()', () => {
    it('returns true when sibling depName matches newName', () => {
      const currentDep: PackageDependency = { depName: '@material-ui/core' };
      const deps: PackageDependency[] = [
        currentDep,
        { depName: '@mui/material' },
      ];

      expect(
        replacementAlreadyExists(deps, currentDep, '@mui/material'),
      ).toBeTrue();
    });

    it('returns true when sibling packageName matches newName', () => {
      const currentDep: PackageDependency = { depName: 'old-pkg' };
      const deps: PackageDependency[] = [
        currentDep,
        { depName: 'alias', packageName: 'new-pkg' },
      ];

      expect(replacementAlreadyExists(deps, currentDep, 'new-pkg')).toBeTrue();
    });

    it('returns false when no sibling matches newName', () => {
      const currentDep: PackageDependency = { depName: '@material-ui/core' };
      const deps: PackageDependency[] = [
        currentDep,
        { depName: 'unrelated-package' },
      ];

      expect(
        replacementAlreadyExists(deps, currentDep, '@mui/material'),
      ).toBeFalse();
    });

    it('does not match the current dep itself', () => {
      const currentDep: PackageDependency = { depName: '@mui/material' };
      const deps: PackageDependency[] = [currentDep];

      expect(
        replacementAlreadyExists(deps, currentDep, '@mui/material'),
      ).toBeFalse();
    });
  });

  describe('formatProblemLevel()', () => {
    it('handles trace level', () => {
      expect(formatProblemLevel(TRACE)).toEqual('🔬 TRACE');
    });

    it('handles debug level', () => {
      expect(formatProblemLevel(DEBUG)).toEqual('🔍 DEBUG');
    });

    it('handles info level', () => {
      expect(formatProblemLevel(INFO)).toEqual('ℹ️ INFO');
    });

    it('handles warn level', () => {
      expect(formatProblemLevel(WARN)).toEqual('⚠️ WARN');
    });

    it('handles error level', () => {
      expect(formatProblemLevel(ERROR)).toEqual('❌ ERROR');
    });

    it('handles fatal level', () => {
      expect(formatProblemLevel(FATAL)).toEqual('💀 FATAL');
    });
  });
});
