export interface BatectConfig {
  containers?: Record<string, BatectContainer>;
}

interface BatectContainer {
  image?: string;
}
