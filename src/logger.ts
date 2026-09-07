export function log(message: string, data?: unknown): void {
  const suffix = data === undefined ? '' : ` ${JSON.stringify(data)}`;
  console.log(`${new Date().toISOString()} ${message}${suffix}`);
}

export function warn(message: string, data?: unknown): void {
  const suffix = data === undefined ? '' : ` ${JSON.stringify(data)}`;
  console.warn(`${new Date().toISOString()} ${message}${suffix}`);
}
