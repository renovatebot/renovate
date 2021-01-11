const secrets = new Set<string>();

export const redactedFields = [
  'authorization',
  'token',
  'githubAppKey',
  'npmToken',
  'npmrc',
  'yarnrc',
  'privateKey',
  'gitPrivateKey',
  'forkToken',
  'password',
];

export function sanitize(input: string): string {
  if (!input) {
    return input;
  }
  let output: string = input;
  secrets.forEach((secret) => {
    while (output.includes(secret)) {
      output = output.replace(secret, '**redacted**');
    }
  });
  return output;
}

export function add(secret: string): void {
  secrets.add(secret);
  secrets.add(secret?.replace('x-access-token:', '')); // GitHub App tokens
}

export function clear(): void {
  secrets.clear();
}
