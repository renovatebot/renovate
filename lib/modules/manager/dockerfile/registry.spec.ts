import { DateTime } from 'luxon';
import type { PackageDependency } from '../types.ts';
import { detectApkRegistryUrls, detectDebRegistryUrls } from './registry.ts';

interface UndetectedCase {
  name: string;
  image: PackageDependency;
}

interface DetectedCase extends UndetectedCase {
  expected: string[];
}

describe('modules/manager/dockerfile/registry', () => {
  // Debian's rolling aliases name whichever release is current, so the clock is
  // pinned to a date at which `stable` was bookworm and `oldstable` bullseye
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DateTime.fromISO('2024-07-01').valueOf());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe('detectApkRegistryUrls()', () => {
    it.each<UndetectedCase>([
      {
        name: 'a `FROM` Renovate could not parse',
        image: { skipReason: 'contains-variable' },
      },
      {
        name: 'an image built on Alpine which names no release',
        image: { depName: 'vault', currentValue: '1.13.3' },
      },
      {
        name: 'a tag naming Alpine but not which release',
        image: { depName: 'node', currentValue: '22-alpine' },
      },
      {
        name: 'a release which is not a branch',
        image: { depName: 'alpine', currentValue: '3.22.0_rc1' },
      },
      {
        name: 'an untagged image which is not Alpine',
        image: { depName: 'node' },
      },
    ])('returns nothing for $name', ({ image }) => {
      expect(detectApkRegistryUrls(image)).toBeUndefined();
    });

    it.each<DetectedCase>([
      {
        name: 'the alpine image',
        image: { depName: 'alpine', currentValue: '3.21' },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=v3.21&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'an alpine point release',
        image: { depName: 'alpine', currentValue: '3.21.4' },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=v3.21&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'a registry-qualified alpine image',
        image: {
          depName: 'public.ecr.aws/docker/library/alpine',
          currentValue: '3.19',
        },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=v3.19&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'an untagged alpine image',
        image: { depName: 'alpine' },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=latest-stable&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'the alpine latest tag',
        image: { depName: 'alpine', currentValue: 'latest' },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=latest-stable&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'the alpine edge tag',
        image: { depName: 'alpine', currentValue: 'edge' },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=edge&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'the release another image tags itself with',
        image: { depName: 'node', currentValue: '22-alpine3.21' },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=v3.21&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'the Wolfi base image',
        image: {
          depName: 'cgr.dev/chainguard/wolfi-base',
          currentValue: 'latest',
        },
        expected: ['https://packages.wolfi.dev/os?arch=x86_64'],
      },
      {
        name: 'any Chainguard image',
        image: { depName: 'cgr.dev/chainguard/node' },
        expected: ['https://packages.wolfi.dev/os?arch=x86_64'],
      },
      {
        name: 'a mirrored Wolfi base image',
        image: { depName: 'my-mirror.io/wolfi-base' },
        expected: ['https://packages.wolfi.dev/os?arch=x86_64'],
      },
    ])('detects $name', ({ image, expected }) => {
      expect(detectApkRegistryUrls(image)).toEqual(expected);
    });
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
