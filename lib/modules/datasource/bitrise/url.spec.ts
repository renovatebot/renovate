import { isPublicRegistry } from './url.ts';

describe('modules/datasource/bitrise/url', () => {
  it.each`
    registryUrl                                                       | expected
    ${'https://github.com/bitrise-io/bitrise-steplib.git'}            | ${true}
    ${'https://github.com/bitrise-io/bitrise-steplib/'}               | ${true}
    ${'HTTPS://GITHUB.COM/BITRISE-IO/BITRISE-STEPLIB'}                | ${true}
    ${'https://github.com:443/bitrise-io/bitrise-steplib.git/'}       | ${true}
    ${'http://github.com:80/bitrise-io/bitrise-steplib'}              | ${true}
    ${'http://github.com:8080/bitrise-io/bitrise-steplib'}            | ${true}
    ${'ssh://git@github.com/bitrise-io/bitrise-steplib.git'}          | ${true}
    ${'ssh://github.com/bitrise-io/bitrise-steplib'}                  | ${true}
    ${'https://github.com/bitrise-io/%62itrise-steplib'}              | ${true}
    ${undefined}                                                      | ${false}
    ${''}                                                             | ${false}
    ${'git@github.com:bitrise-io/bitrise-steplib.git'}                | ${false}
    ${'https://github.com/custom/private-library'}                    | ${false}
    ${'https://github.mycompany.com/bitrise-io/bitrise-steplib'}      | ${false}
    ${'https://www.github.com/bitrise-io/bitrise-steplib'}            | ${false}
    ${'https://github.com.evil.test/bitrise-io/bitrise-steplib'}      | ${false}
    ${'secret://github.com/bitrise-io/bitrise-steplib'}               | ${false}
    ${'https://user:password@github.com/bitrise-io/bitrise-steplib'}  | ${false}
    ${'https://token@github.com/bitrise-io/bitrise-steplib'}          | ${false}
    ${'ssh://token@github.com/bitrise-io/bitrise-steplib.git'}        | ${false}
    ${'ssh://git:password@github.com/bitrise-io/bitrise-steplib.git'} | ${false}
    ${'https://github.com/bitrise-io/bitrise-steplib?token=secret'}   | ${false}
    ${'https://github.com/bitrise-io/bitrise-steplib#secret'}         | ${false}
    ${'https://github.com/bitrise-io/bitrise-steplib/tree/secret'}    | ${false}
    ${'https://github.com/bitrise-io/secret/../bitrise-steplib'}      | ${false}
    ${'https://github.com/bitrise-io/bitrise-steplib-other'}          | ${false}
    ${'https://github.com/bitrise-io/bitrise-steplib/extra'}          | ${false}
    ${'https://github.com/bitrise-io/bitrise-steplib%2Fextra'}        | ${false}
    ${'https://github.com/bitrise-io/bitrise-steplib%FF'}             | ${false}
    ${'https://github.com/bitrise-io/bitrise-steplib%'}               | ${false}
  `('returns $expected for $registryUrl', ({ registryUrl, expected }) => {
    expect(isPublicRegistry(registryUrl)).toBe(expected);
  });
});
