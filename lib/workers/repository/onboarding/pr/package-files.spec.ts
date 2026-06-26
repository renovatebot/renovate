import { partial } from '~test/util.ts';
import type { PackageFile } from '../../../../modules/manager/types.ts';
import {
  getPackageFilesDesc,
  getPackageFilesSummary,
} from './package-files.ts';

describe('workers/repository/onboarding/pr/package-files', () => {
  describe('getPackageFilesDesc()', () => {
    it('returns empty string when packageFiles is null', () => {
      expect(getPackageFilesDesc(null)).toBeEmptyString();
    });

    it('returns empty string when packageFiles is empty', () => {
      expect(getPackageFilesDesc({})).toBeEmptyString();
    });

    it('returns formatted markdown for a single manager', () => {
      const res = getPackageFilesDesc({
        npm: [partial<PackageFile>({ packageFile: 'package.json' })],
      });
      expect(res).toBe('### Detected Package Files\n\n * `package.json` (npm)');
    });

    it('returns formatted markdown for multiple managers', () => {
      const res = getPackageFilesDesc({
        npm: [
          partial<PackageFile>({ packageFile: 'package.json' }),
          partial<PackageFile>({ packageFile: 'a/package.json' }),
        ],
        dockerfile: [partial<PackageFile>({ packageFile: 'Dockerfile' })],
      });
      expect(res).toBe(
        '### Detected Package Files\n\n * `package.json` (npm)\n * `a/package.json` (npm)\n * `Dockerfile` (dockerfile)',
      );
    });

    it('returns formatted markdown for many files across managers, including a file handled by multiple managers', () => {
      const res = getPackageFilesDesc({
        npm: [
          partial<PackageFile>({ packageFile: 'package.json' }),
          partial<PackageFile>({ packageFile: 'frontend/package.json' }),
          partial<PackageFile>({ packageFile: 'backend/package.json' }),
        ],
        dockerfile: [
          partial<PackageFile>({ packageFile: 'Dockerfile' }),
          partial<PackageFile>({ packageFile: 'services/api/Dockerfile' }),
        ],
        'docker-compose': [
          partial<PackageFile>({ packageFile: 'docker-compose.yml' }),
        ],
        'github-actions': [
          partial<PackageFile>({ packageFile: '.github/workflows/ci.yml' }),
          partial<PackageFile>({
            packageFile: '.github/workflows/release.yml',
          }),
        ],
        regex: [partial<PackageFile>({ packageFile: 'Dockerfile' })],
      });
      expect(res).toBe(
        '### Detected Package Files\n\n' +
          ' * `package.json` (npm)\n' +
          ' * `frontend/package.json` (npm)\n' +
          ' * `backend/package.json` (npm)\n' +
          ' * `Dockerfile` (dockerfile)\n' +
          ' * `services/api/Dockerfile` (dockerfile)\n' +
          ' * `docker-compose.yml` (docker-compose)\n' +
          ' * `.github/workflows/ci.yml` (github-actions)\n' +
          ' * `.github/workflows/release.yml` (github-actions)\n' +
          ' * `Dockerfile` (regex)',
      );
    });
  });

  describe('getPackageFilesSummary()', () => {
    it('returns empty string when packageFiles is null', () => {
      expect(getPackageFilesSummary(null)).toBeEmptyString();
    });

    it('returns empty string when packageFiles is empty', () => {
      expect(getPackageFilesSummary({})).toBeEmptyString();
    });

    it('returns grouped markdown for a single manager', () => {
      const res = getPackageFilesSummary({
        npm: [partial<PackageFile>({ packageFile: 'package.json' })],
      });
      expect(res).toBe('#### npm\n\n * `package.json`');
    });

    it('returns grouped markdown for many files across managers, including a file handled by multiple managers', () => {
      const res = getPackageFilesSummary({
        npm: [
          partial<PackageFile>({ packageFile: 'package.json' }),
          partial<PackageFile>({ packageFile: 'frontend/package.json' }),
          partial<PackageFile>({ packageFile: 'backend/package.json' }),
        ],
        dockerfile: [
          partial<PackageFile>({ packageFile: 'Dockerfile' }),
          partial<PackageFile>({ packageFile: 'services/api/Dockerfile' }),
        ],
        'docker-compose': [
          partial<PackageFile>({ packageFile: 'docker-compose.yml' }),
        ],
        'github-actions': [
          partial<PackageFile>({ packageFile: '.github/workflows/ci.yml' }),
          partial<PackageFile>({
            packageFile: '.github/workflows/release.yml',
          }),
        ],
        regex: [partial<PackageFile>({ packageFile: 'Dockerfile' })],
      });
      expect(res).toBe(
        '#### npm\n\n' +
          ' * `package.json`\n' +
          ' * `frontend/package.json`\n' +
          ' * `backend/package.json`\n\n' +
          '#### dockerfile\n\n' +
          ' * `Dockerfile`\n' +
          ' * `services/api/Dockerfile`\n\n' +
          '#### docker-compose\n\n' +
          ' * `docker-compose.yml`\n\n' +
          '#### github-actions\n\n' +
          ' * `.github/workflows/ci.yml`\n' +
          ' * `.github/workflows/release.yml`\n\n' +
          '#### regex\n\n' +
          ' * `Dockerfile`',
      );
    });
  });
});
