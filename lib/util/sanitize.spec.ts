import {
  addSecretForSanitizing,
  clearSanitizedSecretsList,
  sanitize,
} from './sanitize';
import { toBase64 } from './string';

describe('util/sanitize', () => {
  beforeEach(() => {
    clearSanitizedSecretsList();
  });

  it('sanitizes empty string', () => {
    expect(sanitize(null as never)).toBeNull();
    expect(sanitize('')).toBe('');
  });
  it('sanitizes secrets from strings', () => {
    const token = '123testtoken';
    const username = 'userabc';
    const password = 'password123';
    addSecretForSanitizing(token);
    const hashed = toBase64(`${username}:${password}`);
    addSecretForSanitizing(hashed);
    addSecretForSanitizing(password);

    const input = `My token is ${token}, username is "${username}" and password is "${password}" (hashed: ${hashed})`;
    const output =
      'My token is **redacted**, username is "userabc" and password is "**redacted**" (hashed: **redacted**)';
    expect(sanitize(input)).toBe(output);

    const inputX2 = [input, input].join('\n');
    const outputX2 = [output, output].join('\n');
    expect(sanitize(inputX2)).toBe(outputX2);
  });
});
