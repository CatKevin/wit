import fs from 'fs/promises';
import path from 'path';
import {ensureDirForFile, readBlob, readIndex, writeIndex, Index, removeFileIfExists} from '../lib/fs';
import {readCommitById, readHeadRefPath} from '../lib/state';

const WIT_DIR = '.wit';

export async function checkoutAction(commitId: string): Promise<void> {
  const witPath = await requireWitDir();
  const commit = await readCommitById(witPath, commitId);

  const headRefPath = await readHeadRefPath(witPath);
  const indexPath = path.join(witPath, 'index');
  const currentIndex = await readIndex(indexPath);

  const targetFiles = commit.tree.files;

  // Remove tracked files not present in target commit
  for (const rel of Object.keys(currentIndex)) {
    if (targetFiles[rel]) continue;
    const abs = path.join(process.cwd(), rel);
    await removeFileIfExists(abs);
  }

  // Materialize commit files into worktree
  for (const [rel, meta] of Object.entries(targetFiles)) {
    const buf = await readBlob(witPath, meta.hash);
    if (!buf) {
      throw new Error(`Missing blob for ${rel} (${meta.hash}); cannot checkout.`);
    }
    const abs = path.join(process.cwd(), rel);
    await ensureDirForFile(abs);
    await fs.writeFile(abs, buf);
    const perm = parseInt(meta.mode, 8) & 0o777;
    await fs.chmod(abs, perm);
  }

  // Update index and head ref
  await writeIndex(indexPath, targetFiles as Index);
  await fs.writeFile(headRefPath, `${commitId}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Checked out ${commitId}`);
}

async function requireWitDir(): Promise<string> {
  const dir = path.join(process.cwd(), WIT_DIR);
  try {
    await fs.access(dir);
    return dir;
  } catch {
    throw new Error('Not a wit repository (missing .wit). Run `wit init` first.');
  }
}
