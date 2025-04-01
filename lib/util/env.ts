let customEnv: Record<string, string> = {};

export function setCustomEnv(envObj: Record<string, string>): void {
  customEnv = envObj;
}

export function getCustomEnv(): Record<string, string> {
  return customEnv;
}
