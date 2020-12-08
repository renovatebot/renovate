export interface BatectConfig {
  containers?: Record<string, BatectContainer>;
}

export interface BatectContainer {
  image?: string;
}
