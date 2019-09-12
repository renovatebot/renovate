const secrets = new Set<string>();

export function sanitize(input: string) {
  if (!input) return input;
  let output: string = input;
  secrets.forEach(secret => {
    while (output.includes(secret)) {
      output = output.replace(secret, '**redacted**');
    }
  });
  return output;
}

export function add(secret: string) {
  secrets.add(secret);
}

export function clear() {
  secrets.clear();
}
