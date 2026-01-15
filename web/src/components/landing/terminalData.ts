// 真实的终端命令数据，来自 ShellExample.md

export interface TerminalLine {
    text: string;
    type: "command" | "output" | "success" | "warning" | "info" | "error";
    delay?: number;
}

// wit --help 完整输出
export const helpLines: TerminalLine[] = [
    { type: "command", text: "wit --help", delay: 300 },
    { type: "output", text: "Usage: wit [options] [command]", delay: 50 },
    { type: "output", text: "", delay: 20 },
    { type: "info", text: "wit CLI: Decentralized Git on Mantle (storage via IPFS + encryption via Lit Protocol)", delay: 50 },
    { type: "output", text: "", delay: 20 },
    { type: "output", text: "Options:", delay: 30 },
    { type: "output", text: "  -V, --version                    output the version number", delay: 30 },
    { type: "output", text: "  -h, --help                       display help for command", delay: 30 },
    { type: "output", text: "", delay: 20 },
    { type: "output", text: "Commands:", delay: 30 },
    { type: "success", text: "  init [options] [name]            Initialize a wit repository", delay: 30 },
    { type: "success", text: "  add [paths...]                   Add file(s) to the wit index", delay: 30 },
    { type: "success", text: "  commit [options]                 Create a local commit", delay: 30 },
    { type: "success", text: "  push                             Upload to IPFS and update Mantle head", delay: 30 },
    { type: "success", text: "  clone <repo_id>                  Clone a wit repository", delay: 30 },
    { type: "success", text: "  pull                             Fetch and fast-forward to remote head", delay: 30 },
    { type: "info", text: "  invite <address>                 Add a collaborator to the repository", delay: 30 },
    { type: "info", text: "  list                             List repositories you own/collaborate on", delay: 30 },
    { type: "info", text: "  account                          Manage wit accounts (keys, active address)", delay: 30 },
    { type: "output", text: "  help [command]                   display help for command", delay: 30 },
];

// Scene 1: 初始化私有仓库
export const initLines: TerminalLine[] = [
    { type: "command", text: "wit init repo-sync-test --private", delay: 300 },
    { type: "success", text: "Initialized as PRIVATE repository (Lit Protocol). Encryption will be enabled on first push.", delay: 100 },
    { type: "output", text: "Initialized wit repo scaffold in /private/.../repo-sync-test/.wit", delay: 50 },
];

// Scene 2: 添加文件并提交 + log
export const addCommitLines: TerminalLine[] = [
    { type: "command", text: 'echo "v1 content" > readme.md', delay: 300 },
    { type: "command", text: "wit add .", delay: 400 },
    { type: "output", text: "added .gitignore", delay: 50 },
    { type: "output", text: "added .witignore", delay: 50 },
    { type: "output", text: "added readme.md", delay: 50 },
    { type: "command", text: 'wit commit -m "init v1"', delay: 400 },
    { type: "success", text: "Committed sha256-4hiPwemwc88x3A4DDhpiGRaGRl8I8gRxdTyQL7d8wqo=", delay: 100 },
    { type: "command", text: "wit log", delay: 300 },
    { type: "output", text: "Local (HEAD):", delay: 100 },
    { type: "info", text: "commit sha256-4hiPwemwc88x3A4DDhpiGRaGRl8I8gRxdTyQL7d8wqo=", delay: 50 },
    { type: "output", text: "Author: 0x2Dc6B355Db4367877AB449CB206D2fBf7f125827", delay: 50 },
    { type: "output", text: "Date:   2026-01-15T08:14:19.000Z", delay: 50 },
    { type: "output", text: "", delay: 20 },
    { type: "output", text: "    init v1", delay: 50 },
];

// Scene 3: Push 到链上 - 完整输出
export const pushLines: TerminalLine[] = [
    { type: "command", text: "wit push", delay: 300 },
    { type: "output", text: "Starting push (Mantle Mainnet)...", delay: 200 },
    { type: "info", text: "Using account 0x2Dc6B355Db4367877AB449CB206D2fBf7f125827", delay: 100 },
    { type: "output", text: "Creating repo \"repo-sync-test\" on contract 0xbc89...203...", delay: 50 },
    { type: "success", text: "Created on-chain repository 0x00...002 (Mantle Mainnet)", delay: 200 },
    { type: "output", text: "Found 1 commit(s) to push.", delay: 50 },
    { type: "info", text: "  Using Lit Action CID: bafkreibbq3fltufjarcmk45426mhhssky5izkjuxio7im26q6lxlf2qbda", delay: 50 },
    { type: "output", text: "Uploading commit 1/1: sha256-4hiPwemwc88x3A4DDhpiGRaGRl8I8gRxdTyQL7d8wqo=", delay: 100 },
    { type: "info", text: "  Encrypting 3 files (AES-256-GCM) & sealing with Lit Protocol...", delay: 100 },
    { type: "success", text: "Uploaded commit sha256-4hiPwemwc8... bafkreich4ucwwexn5rrnmra52wgwpf2vet25e2deo4hkbggic5pa4bwrzm", delay: 100 },
    { type: "output", text: "Updating head for repo 0x00...002 to version 1...", delay: 50 },
    { type: "success", text: "Tx sent: https://mantlescan.xyz/tx/0x9e56290df2cf52974c277c537374e792295362870ee916c9cd291151f417058c", delay: 100 },
    { type: "success", text: "On-chain head updated", delay: 50 },
    { type: "success", text: "Push (Mantle) complete.", delay: 100 },
];

// Scene 4: Clone 仓库 - 在新的空目录 clone 项目
export const cloneLines: TerminalLine[] = [
    { type: "command", text: "tmp=$(mktemp -d) && cd \"$tmp\"", delay: 300 },
    { type: "command", text: "ls", delay: 300 },
    { type: "command", text: "wit clone 0x0000000000000000000000000000000000000002", delay: 300 },
    { type: "output", text: "Starting clone...", delay: 200 },
    { type: "output", text: "Fetching repository info from Mantle...", delay: 300 },
    { type: "output", text: "Downloading manifest from IPFS...", delay: 200 },
    { type: "output", text: "Decrypting content via Lit Protocol...", delay: 400 },
    { type: "success", text: "Clone complete.", delay: 200 },
    { type: "info", text: "Head: bafkreich4ucwwexn5rrnmra52wgwpf2vet25e2deo4hkbggic5pa4bwrzm", delay: 50 },
    { type: "command", text: "ls", delay: 400 },
    { type: "output", text: "readme.md  .wit", delay: 100 },
];

// Scene 5: 邀请协作者
export const inviteLines: TerminalLine[] = [
    { type: "command", text: "wit invite 0x543A5Cc20B05E2001B39722fF3C19D96fDf883a7", delay: 300 },
    { type: "output", text: "Adding collaborator 0x543A5Cc20B05E2001B39722fF3C19D96fDf883a7 to repo 0x00...002...", delay: 300 },
    { type: "success", text: "Tx sent: https://mantlescan.xyz/tx/0xf8421b59885d0a6990d8a29307b760b6a864a3fb81700b43ab026e694a151f16", delay: 200 },
    { type: "success", text: "✅ Collaborator 0x543A5Cc20B05E2001B39722fF3C19D96fDf883a7 added successfully.", delay: 100 },
    { type: "info", text: "They can now decrypt the repository using Lit Protocol.", delay: 100 },
];

// Scene 6: 列出仓库
export const listLines: TerminalLine[] = [
    { type: "command", text: "wit list", delay: 300 },
    { type: "output", text: "Listing repositories for 0x2Dc6B355Db4367877AB449CB206D2fBf7f125827...", delay: 200 },
    { type: "output", text: "┌─────────┬────────────────────────────────────────────┬──────────────┬─────────┐", delay: 50 },
    { type: "output", text: "│ (index) │                     id                     │     name     │  role   │", delay: 50 },
    { type: "output", text: "├─────────┼────────────────────────────────────────────┼──────────────┼─────────┤", delay: 50 },
    { type: "output", text: "│    0    │ '0x0000000000000000000000000000000000...01'│ 'my-project' │ 'Owner' │", delay: 50 },
    { type: "output", text: "│    1    │ '0x0000000000000000000000000000000000...02'│ 'repo-sync'  │ 'Owner' │", delay: 50 },
    { type: "output", text: "└─────────┴────────────────────────────────────────────┴──────────────┴─────────┘", delay: 50 },
];

// Scene 7: 账户管理
export const accountLines: TerminalLine[] = [
    { type: "command", text: "wit account list", delay: 300 },
    { type: "output", text: "  0x2Dc6B355...f7f125827 (default) ← active", delay: 50 },
    { type: "output", text: "  0x543A5Cc2...fDf883a7 (test)", delay: 50 },
    { type: "command", text: "wit account balance", delay: 400 },
    { type: "output", text: "Account 0x2Dc6B355Db4367877AB449CB206D2fBf7f125827", delay: 100 },
    { type: "output", text: "Network: mantle (5000, mainnet)", delay: 50 },
    { type: "output", text: "RPC: https://rpc.mantle.xyz", delay: 50 },
    { type: "success", text: "MNT: 0.626745151102 MNT", delay: 50 },
    { type: "output", text: "Gas estimate (simple transfer):", delay: 50 },
    { type: "output", text: "  gasLimit: 88391722", delay: 20 },
    { type: "output", text: "  maxFeePerGas: 0.0401 gwei", delay: 20 },
    { type: "output", text: "  maxPriorityFeePerGas: 0.0001 gwei", delay: 20 },
    { type: "output", text: "  gasPrice: 0.0201 gwei", delay: 20 },
    { type: "info", text: "  estCost: 0.0035445080522 MNT", delay: 50 },
    { type: "command", text: "wit account generate", delay: 400 },
    { type: "success", text: "Generated 0x8a92b...12c9d and set as active.", delay: 200 },
];

