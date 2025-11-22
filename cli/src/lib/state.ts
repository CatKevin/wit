import fs from 'fs/promises';
import path from 'path';
import {Index} from './fs';

export type CommitObject = {
  tree: {
    root_hash: string;
    manifest_id: string | null;
    quilt_id: string | null;
    files: Index;
  };
  parent: string | null;
  author: string;
  message: string;
  timestamp: number;
  extras: {
    patch_id: null;
    tags: Record<string, string>;
  };
};

export async function readHeadRefPath(witPath: string): Promise<string> {
  const headFile = path.join(witPath, 'HEAD');
  const raw = await fs.readFile(headFile, 'utf8');
  const ref = raw.trim() || 'refs/heads/main';
  return path.join(witPath, ref);
}

export async function readRef(refPath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(refPath, 'utf8');
    const val = raw.trim();
    return val.length ? val : null;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

export async function readCommitById(witPath: string, commitId: string): Promise<CommitObject> {
  const file = path.join(witPath, 'objects', 'commits', `${idToFileName(commitId)}.json`);
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw) as CommitObject;
}

export function idToFileName(id: string): string {
  return id.replace(/\//g, '_').replace(/\+/g, '-');
}
