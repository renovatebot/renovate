export interface PubspecSdk {
  dart: string;
  flutter?: string;
}

export interface PubspecLock {
  sdks: PubspecSdk;
}
