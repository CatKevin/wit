import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import ignore, {Ignore} from 'ignore';

export type FileMeta = {
  hash: string;
  size: number;
  mode: string;
  mtime: number;
  enc?: {
    alg: 'aes-256-gcm';
    iv: string;
    tag: string;
    policy?: string;
    cipher_size?: number;
  };
};

export type Index = Record<string, FileMeta>;

const HASH_PREFIX = 'sha256-';
const DEFAULT_IGNORE_PATTERNS = ['.git', '.wit', 'node_modules'];
const BLOB_DIR = 'objects/blobs';

export function pathToPosix(p: string): string {
  return p.split(path.sep).join('/');
}

export function modeToString(mode: number): string {
  const isExec = (mode & 0o111) !== 0;
  return `100${isExec ? '755' : '644'}`;
}

export function mtimeSec(stat: {mtimeMs: number}): number {
  return Math.floor(stat.mtimeMs / 1000);
}

export async function computeFileMeta(filePath: string): Promise<FileMeta> {
  const stat = await fs.stat(filePath);
  const data = await fs.readFile(filePath);
  const hash = HASH_PREFIX + crypto.createHash('sha256').update(data).digest('base64');
  return {
    hash,
    size: stat.size,
    mode: modeToString(stat.mode),
    mtime: mtimeSec(stat),
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

export function blobFileName(hash: string): string {
  return hash.replace(/\//g, '_').replace(/\+/g, '-');
}

export async function ensureBlobFromFile(witPath: string, hash: string, filePath: string): Promise<void> {
  const blobPath = path.join(witPath, BLOB_DIR, blobFileName(hash));
  try {
    await fs.access(blobPath);
    return;
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  }
  await fs.mkdir(path.dirname(blobPath), {recursive: true});
  const data = await fs.readFile(filePath);
  await fs.writeFile(blobPath, data);
}

export async function readBlob(witPath: string, hash: string): Promise<Buffer | null> {
  const blobPath = path.join(witPath, BLOB_DIR, blobFileName(hash));
  try {
    return await fs.readFile(blobPath);
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

export async function ensureDirForFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
}

export async function removeFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }
}

export async function buildIgnore(root: string, extraPatterns: string[] = []): Promise<Ignore> {
  const ig = ignore();
  ig.add(DEFAULT_IGNORE_PATTERNS);
  ig.add(extraPatterns);
  for (const file of ['.gitignore', '.witignore']) {
    try {
      const raw = await fs.readFile(path.join(root, file), 'utf8');
      ig.add(raw);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
    }
  }
  return ig;
}

export function shouldIgnore(ig: Ignore, relPosix: string, isDir: boolean): boolean {
  if (relPosix === '' || relPosix === '.') return false;
  const target = isDir ? (relPosix.endsWith('/') ? relPosix : `${relPosix}/`) : relPosix;
  return ig.ignores(target);
}

export async function walkFiles(
  root: string,
  ig: Ignore,
  baseDir: string = root,
  tracked?: Set<string>
): Promise<string[]> {
  const trackedList = tracked ? Array.from(tracked) : null;

  async function walkDir(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, {withFileTypes: true});
    const files: string[] = [];
    const dirTasks: Promise<string[]>[] = [];

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(baseDir, full);
      const relPosix = pathToPosix(rel);
      const isDir = entry.isDirectory();
      const hasTrackedDesc =
        trackedList && isDir ? trackedList.some((p) => p === relPosix || p.startsWith(`${relPosix}/`)) : false;

      if (shouldIgnore(ig, relPosix, isDir) && !(tracked?.has(relPosix) || hasTrackedDesc)) continue;

      if (isDir) {
        dirTasks.push(walkDir(full));
      } else if (entry.isFile()) {
        files.push(full);
      }
    }

    if (dirTasks.length) {
      const nested = await Promise.all(dirTasks);
      nested.forEach((list) => files.push(...list));
    }
    return files;
  }

  return walkDir(root);
}
