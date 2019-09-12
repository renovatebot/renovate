import { add, clear, sanitize } from '../../lib/util/sanitize';

describe('util/sanitize', () => {
  beforeEach(() => {
    clear();
  });

  it('sanitizes empty string', () => {
    expect(sanitize(null)).toEqual(null);
  });
  it('sanitizes secrets from strings', () => {
    const token = 'abc123token';
    const username = 'userabc';
    const password = 'password123';
    add(token);
    const hashed = Buffer.from(`${username}:${password}`).toString('base64');
    add(hashed);
    add(password);
    expect(
      sanitize(
        `My token is ${token}, username is "${username}" and password is "${password}" (hashed: ${hashed})`
      )
    ).toMatchSnapshot();
  });
});
