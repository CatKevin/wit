import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export type FileMeta = {
  hash: string;
  size: number;
  mode: string;
  mtime: number;
};

export type Index = Record<string, FileMeta>;

const HASH_PREFIX = 'sha256-';

export function pathToPosix(p: string): string {
  return p.split(path.sep).join('/');
}

export function modeToString(mode: number): string {
  const isExec = (mode & 0o111) !== 0;
  return `100${isExec ? '755' : '644'}`;
}

export async function computeFileMeta(filePath: string): Promise<FileMeta> {
  const stat = await fs.stat(filePath);
  const data = await fs.readFile(filePath);
  const hash = HASH_PREFIX + crypto.createHash('sha256').update(data).digest('base64');
  return {
    hash,
    size: stat.size,
    mode: modeToString(stat.mode),
    mtime: Math.floor(stat.mtimeMs / 1000),
  };
}

export async function readIndex(indexPath: string): Promise<Index> {
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    return JSON.parse(raw) as Index;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return {};
    throw err;
  }
}

export async function writeIndex(indexPath: string, index: Index): Promise<void> {
  const serialized = JSON.stringify(index, null, 2) + '\n';
  await fs.writeFile(indexPath, serialized, 'utf8');
}

export async function walkFiles(root: string, ignore: Set<string>): Promise<string[]> {
  const entries = await fs.readdir(root, {withFileTypes: true});
  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(root, entry.name);
    const rel = path.relative(process.cwd(), full);
    const relPosix = pathToPosix(rel);

    if (ignore.has(relPosix) || ignore.has(entry.name)) continue;

    if (entry.isDirectory()) {
      // avoid descending into ignored dirs early
      if (ignore.has(relPosix + '/')) continue;
      const nested = await walkFiles(full, ignore);
      files.push(...nested);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}
