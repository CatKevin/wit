import { z } from 'zod';

const fileMeta = z.object({
  hash: z.string().min(1),
  size: z.number().int().nonnegative(),
  mode: z.string().regex(/^\d{6}$/),
  mtime: z.number().int().nonnegative(),
  id: z.string().min(1).optional(),
  cid: z.string().min(1).optional(),
  enc: z
    .object({
      alg: z.union([
        z.literal('aes-256-gcm'),
        z.literal('seal-aes-256-gcm'),
        z.literal('lit-aes-256-gcm'),
      ]),
      iv: z.string().min(1),
      tag: z.string().min(1),
      policy: z.string().min(1).optional(),
      policy_id: z.string().min(1).optional(),
      package_id: z.string().min(1).optional(),
      sealed_session_key: z.string().min(1).optional(),
      cipher_size: z.number().int().nonnegative().optional(),
      // Lit Protocol specific fields
      lit_encrypted_key: z.string().min(1).optional(),
      lit_hash: z.string().min(1).optional(),
      access_control_conditions: z.array(z.any()).optional(),
      unified_access_control_conditions: z.array(z.any()).optional(),
      lit_chain: z.string().min(1).optional(),
      lit_network: z.string().min(1).optional(),
    })
    .optional(),
});

export const ManifestSchema = z
  .object({
    version: z.literal(1),
    quilt_id: z.string().min(1).optional(),
    snapshot_cid: z.string().min(1).optional(),
    root_hash: z.string().min(1),
    files: z.record(fileMeta),
  });

export const CommitSchema = z.object({
  tree: z
    .object({
      quilt_id: z.string().min(1).nullable().optional(),
      manifest_id: z.string().min(1).nullable().optional(),
      manifest_cid: z.string().min(1).nullable().optional(),
      snapshot_cid: z.string().min(1).nullable().optional(),
      root_hash: z.string().min(1),
      files: z.record(fileMeta).optional(),
    })
    .refine((tree) => Boolean(tree.files || tree.manifest_id || tree.manifest_cid), {
      message: 'Commit tree must include files or manifest id',
    }),
  parent: z.string().min(1).nullable(),
  author: z.string().min(1),
  message: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  extras: z.object({
    patch_id: z.string().nullable(),
    tags: z.record(z.string()),
  }),
});

export const QuiltEntrySchema = z.object({
  identifier: z.string().min(1),
  contents: z.instanceof(Uint8Array).or(z.any()),
  tags: z.record(z.string()).optional(),
});

export const QuiltSchema = z.object({
  blobs: z.array(QuiltEntrySchema),
});

export type Manifest = z.infer<typeof ManifestSchema>;
export type CommitObjectSchema = z.infer<typeof CommitSchema>;
export type FileMeta = z.infer<typeof fileMeta>;
