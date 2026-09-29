import { DateTime } from 'luxon';
import type { PackageDependency } from '../../types.ts';
import { detectDebRegistryUrls } from './deb.ts';

interface UndetectedCase {
  name: string;
  image: PackageDependency;
}

interface DetectedCase extends UndetectedCase {
  expected: string[];
}

describe('modules/manager/dockerfile/registry/deb', () => {
  // Debian's rolling aliases name whichever release is current, so the clock is
  // pinned to a date at which `stable` was bookworm and `oldstable` bullseye
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DateTime.fromISO('2024-07-01').valueOf());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe('detectDebRegistryUrls()', () => {
    it.each<UndetectedCase>([
      {
        name: 'a `FROM` Renovate could not parse',
        image: { skipReason: 'contains-variable' },
      },
      {
        name: 'an image built on Debian which names no release',
        image: { depName: 'node', currentValue: '22' },
      },
      {
        name: 'an untagged image which is not Debian or Ubuntu',
        image: { depName: 'node' },
      },
      {
        name: 'an Alpine tag suffix',
        image: { depName: 'node', currentValue: '22-alpine3.21' },
      },
      {
        name: 'a suite with no release of its own',
        image: { depName: 'debian', currentValue: 'sid' },
      },
      {
        name: 'the debian testing alias',
        image: { depName: 'debian', currentValue: 'testing' },
      },
      {
        name: 'the debian unstable alias',
        image: { depName: 'debian', currentValue: 'unstable' },
      },
      {
        name: 'an Ubuntu floating tag',
        image: { depName: 'ubuntu', currentValue: 'rolling' },
      },
      {
        name: 'an untagged ubuntu image',
        image: { depName: 'ubuntu' },
      },
    ])('returns nothing for $name', ({ image }) => {
      expect(detectDebRegistryUrls(image)).toBeUndefined();
    });

    it.each<DetectedCase>([
      {
        name: 'the debian image',
        image: { depName: 'debian', currentValue: 'trixie' },
        expected: [
          'https://deb.debian.org/debian?suite=trixie&components=main,contrib,non-free&binaryArch=amd64',
        ],
      },
      {
        name: 'a registry-qualified debian image',
        image: {
          depName: 'public.ecr.aws/docker/library/debian',
          currentValue: 'bookworm',
        },
        expected: [
          'https://deb.debian.org/debian?suite=bookworm&components=main,contrib,non-free&binaryArch=amd64',
        ],
      },
      {
        name: 'the suite a debian version names',
        image: { depName: 'debian', currentValue: '12' },
        expected: [
          'https://deb.debian.org/debian?suite=bookworm&components=main,contrib,non-free&binaryArch=amd64',
        ],
      },
      {
        name: 'the suite a debian point release names',
        image: { depName: 'debian', currentValue: '12.11' },
        expected: [
          'https://deb.debian.org/debian?suite=bookworm&components=main,contrib,non-free&binaryArch=amd64',
        ],
      },
      {
        name: 'a debian tag with a variant',
        image: { depName: 'debian', currentValue: 'bookworm-slim' },
        expected: [
          'https://deb.debian.org/debian?suite=bookworm&components=main,contrib,non-free&binaryArch=amd64',
        ],
      },
      {
        name: 'a debian tag with a build date and a variant',
        image: { depName: 'debian', currentValue: 'bookworm-20240110-slim' },
        expected: [
          'https://deb.debian.org/debian?suite=bookworm&components=main,contrib,non-free&binaryArch=amd64',
        ],
      },
      {
        name: 'a debian tag with a build date but no variant',
        image: { depName: 'debian', currentValue: 'bookworm-20240110' },
        expected: [
          'https://deb.debian.org/debian?suite=bookworm&components=main,contrib,non-free&binaryArch=amd64',
        ],
      },
      {
        name: 'the debian stable alias',
        image: { depName: 'debian', currentValue: 'stable-slim' },
        expected: [
          'https://deb.debian.org/debian?suite=bookworm&components=main,contrib,non-free&binaryArch=amd64',
        ],
      },
      {
        name: 'the debian oldstable alias',
        image: { depName: 'debian', currentValue: 'oldstable' },
        expected: [
          'https://deb.debian.org/debian?suite=bullseye&components=main,contrib,non-free&binaryArch=amd64',
        ],
      },
      {
        name: 'the debian latest tag',
        image: { depName: 'debian', currentValue: 'latest' },
        expected: [
          'https://deb.debian.org/debian?suite=bookworm&components=main,contrib,non-free&binaryArch=amd64',
        ],
      },
      {
        name: 'an untagged debian image',
        image: { depName: 'debian' },
        expected: [
          'https://deb.debian.org/debian?suite=bookworm&components=main,contrib,non-free&binaryArch=amd64',
        ],
      },
      {
        name: 'the ubuntu image',
        image: { depName: 'ubuntu', currentValue: 'noble' },
        expected: [
          'https://archive.ubuntu.com/ubuntu?suite=noble&components=main,restricted,universe,multiverse&binaryArch=amd64',
          'https://archive.ubuntu.com/ubuntu?suite=noble-updates&components=main,restricted,universe,multiverse&binaryArch=amd64',
          'https://security.ubuntu.com/ubuntu?suite=noble-security&components=main,restricted,universe,multiverse&binaryArch=amd64',
        ],
      },
      {
        name: 'a registry-qualified ubuntu image',
        image: {
          depName: 'public.ecr.aws/docker/library/ubuntu',
          currentValue: 'noble',
        },
        expected: [
          'https://archive.ubuntu.com/ubuntu?suite=noble&components=main,restricted,universe,multiverse&binaryArch=amd64',
          'https://archive.ubuntu.com/ubuntu?suite=noble-updates&components=main,restricted,universe,multiverse&binaryArch=amd64',
          'https://security.ubuntu.com/ubuntu?suite=noble-security&components=main,restricted,universe,multiverse&binaryArch=amd64',
        ],
      },
      {
        name: 'the suite an ubuntu version names',
        image: { depName: 'ubuntu', currentValue: '24.04' },
        expected: [
          'https://archive.ubuntu.com/ubuntu?suite=noble&components=main,restricted,universe,multiverse&binaryArch=amd64',
          'https://archive.ubuntu.com/ubuntu?suite=noble-updates&components=main,restricted,universe,multiverse&binaryArch=amd64',
          'https://security.ubuntu.com/ubuntu?suite=noble-security&components=main,restricted,universe,multiverse&binaryArch=amd64',
        ],
      },
      {
        name: 'an ubuntu tag with a build date',
        image: { depName: 'ubuntu', currentValue: 'noble-20240801' },
        expected: [
          'https://archive.ubuntu.com/ubuntu?suite=noble&components=main,restricted,universe,multiverse&binaryArch=amd64',
          'https://archive.ubuntu.com/ubuntu?suite=noble-updates&components=main,restricted,universe,multiverse&binaryArch=amd64',
          'https://security.ubuntu.com/ubuntu?suite=noble-security&components=main,restricted,universe,multiverse&binaryArch=amd64',
        ],
      },
      {
        name: 'the release another image tags itself with',
        image: { depName: 'node', currentValue: '22-bookworm-slim' },
        expected: [
          'https://deb.debian.org/debian?suite=bookworm&components=main,contrib,non-free&binaryArch=amd64',
        ],
      },
      {
        name: 'a release named after the image variant',
        image: { depName: 'python', currentValue: '3.12-slim-bookworm' },
        expected: [
          'https://deb.debian.org/debian?suite=bookworm&components=main,contrib,non-free&binaryArch=amd64',
        ],
      },
      {
        name: 'an Ubuntu release another image tags itself with',
        image: { depName: 'eclipse-temurin', currentValue: '21-jdk-jammy' },
        expected: [
          'https://archive.ubuntu.com/ubuntu?suite=jammy&components=main,restricted,universe,multiverse&binaryArch=amd64',
          'https://archive.ubuntu.com/ubuntu?suite=jammy-updates&components=main,restricted,universe,multiverse&binaryArch=amd64',
          'https://security.ubuntu.com/ubuntu?suite=jammy-security&components=main,restricted,universe,multiverse&binaryArch=amd64',
        ],
      },
    ])('detects $name', ({ image, expected }) => {
      expect(detectDebRegistryUrls(image)).toEqual(expected);
    });
  });
});
