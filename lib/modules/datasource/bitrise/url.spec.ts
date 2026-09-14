import { isPublicRegistry } from './url.ts';

describe('modules/datasource/bitrise/url', () => {
  it.each([
    'https://github.com/bitrise-io/bitrise-steplib.git',
    'https://github.com/bitrise-io/bitrise-steplib/',
    'HTTPS://GITHUB.COM/BITRISE-IO/BITRISE-STEPLIB',
    'https://github.com:443/bitrise-io/bitrise-steplib.git/',
    'http://github.com:80/bitrise-io/bitrise-steplib',
    'http://github.com:8080/bitrise-io/bitrise-steplib',
    'ssh://git@github.com/bitrise-io/bitrise-steplib.git',
    'ssh://github.com/bitrise-io/bitrise-steplib',
    'https://github.com/bitrise-io/%62itrise-steplib',
  ])('recognizes safe official library URL %s', (registryUrl) => {
    expect(isPublicRegistry(registryUrl)).toBeTrue();
  });

  it.each([
    undefined,
    '',
    'git@github.com:bitrise-io/bitrise-steplib.git',
    'https://github.com/custom/private-library',
    'https://github.mycompany.com/bitrise-io/bitrise-steplib',
    'https://www.github.com/bitrise-io/bitrise-steplib',
    'https://github.com.evil.test/bitrise-io/bitrise-steplib',
    'secret://github.com/bitrise-io/bitrise-steplib',
    'https://user:password@github.com/bitrise-io/bitrise-steplib',
    'https://token@github.com/bitrise-io/bitrise-steplib',
    'ssh://token@github.com/bitrise-io/bitrise-steplib.git',
    'ssh://git:password@github.com/bitrise-io/bitrise-steplib.git',
    'https://github.com/bitrise-io/bitrise-steplib?token=secret',
    'https://github.com/bitrise-io/bitrise-steplib#secret',
    'https://github.com/bitrise-io/bitrise-steplib/tree/secret',
    'https://github.com/bitrise-io/secret/../bitrise-steplib',
    'https://github.com/bitrise-io/bitrise-steplib-other',
    'https://github.com/bitrise-io/bitrise-steplib/extra',
    'https://github.com/bitrise-io/bitrise-steplib%2Fextra',
    'https://github.com/bitrise-io/bitrise-steplib%FF',
    'https://github.com/bitrise-io/bitrise-steplib%',
  ])('bypasses unknown or secret-bearing URL %s', (registryUrl) => {
    expect(isPublicRegistry(registryUrl)).toBeFalse();
  });
});
