import cmdSerializer from './cmd-serializer';

describe('logger/cmd-serializer', () => {
  it('returns array', () => {
    expect(cmdSerializer([''])).toEqual(['']);
  });

  it('redacts', () => {
    expect(cmdSerializer(' https://token@domain.com')).toEqual(
      ' https://**redacted**@domain.com',
    );
  });
});
