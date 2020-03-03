export interface Logger {
  trace(msg: string): void;
  trace(meta: Record<string, any>, msg?: string): void;
  debug(msg: string): void;
  debug(meta: Record<string, any>, msg?: string): void;
  info(msg: string): void;
  info(meta: Record<string, any>, msg?: string): void;
  warn(msg: string): void;
  warn(meta: Record<string, any>, msg?: string): void;
  error(msg: string): void;
  error(meta: Record<string, any>, msg?: string): void;
  fatal(msg: string): void;
  fatal(meta: Record<string, any>, msg?: string): void;
}
