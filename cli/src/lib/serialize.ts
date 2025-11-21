import crypto from 'crypto';

export function canonicalize(value: any): any {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    const sortedKeys = Object.keys(value).sort();
    const result: Record<string, any> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize((value as any)[key]);
    }
    return result;
  }
  return value;
}

export function canonicalStringify(value: any): string {
  return JSON.stringify(canonicalize(value)) + '\n';
}

export function sha256Base64(data: Buffer | string): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return 'sha256-' + crypto.createHash('sha256').update(buf).digest('base64');
}
