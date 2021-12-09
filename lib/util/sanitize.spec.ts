import { add, clear, sanitize } from './sanitize';

describe('util/sanitize', () => {
  beforeEach(() => {
    clear();
  });

  it('sanitizes empty string', () => {
    expect(sanitize(null)).toBeNull();
  });
  it('sanitizes secrets from strings', () => {
    const token = '123testtoken';
    const username = 'userabc';
    const password = 'password123';
    add(token);
    const hashed = Buffer.from(`${username}:${password}`).toString('base64');
    add(hashed);
    add(password);

    const input = `My token is ${token}, username is "${username}" and password is "${password}" (hashed: ${hashed})`;
    const output =
      'My token is **redacted**, username is "userabc" and password is "**redacted**" (hashed: **redacted**)';
    expect(sanitize(input)).toBe(output);

    const inputX2 = [input, input].join('\n');
    const outputX2 = [output, output].join('\n');
    expect(sanitize(inputX2)).toBe(outputX2);
  });
});
