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
    { type: "info", text: "wit CLI: single-branch, verifiable, optionally encrypted repo tool backed by Walrus + Sui", delay: 50 },
    { type: "output", text: "", delay: 20 },
    { type: "output", text: "Options:", delay: 30 },
    { type: "output", text: "  -V, --version                    output the version number", delay: 30 },
    { type: "output", text: "  -h, --help                       display help for command", delay: 30 },
    { type: "output", text: "", delay: 20 },
    { type: "output", text: "Commands:", delay: 30 },
    { type: "success", text: "  init [options] [name]            Initialize a wit repository", delay: 30 },
    { type: "success", text: "  add [paths...]                   Add file(s) to the wit index", delay: 30 },
    { type: "success", text: "  commit [options]                 Create a local commit", delay: 30 },
    { type: "success", text: "  push                             Upload to Walrus and update Sui head", delay: 30 },
    { type: "success", text: "  clone <repo_id>                  Clone a wit repository", delay: 30 },
    { type: "success", text: "  pull                             Fetch and fast-forward to remote head", delay: 30 },
    { type: "info", text: "  invite <address>                 Add a collaborator to the repository", delay: 30 },
    { type: "info", text: "  list                             List repositories you own/collaborate on", delay: 30 },
    { type: "info", text: "  account                          Manage wit accounts (keys, active address)", delay: 30 },
    { type: "output", text: "  help [command]                   display help for command", delay: 30 },
];

// Scene 1: 初始化私有仓库
export const initLines: TerminalLine[] = [
    { type: "command", text: "wit init demo-repo --private", delay: 300 },
    { type: "success", text: "Initialized as PRIVATE repository. Encryption will be enabled on first push.", delay: 100 },
    { type: "output", text: "Initialized wit repo scaffold in /private/.../demo-repo/.wit", delay: 50 },
];

// Scene 2: 添加文件并提交 + log
export const addCommitLines: TerminalLine[] = [
    { type: "command", text: 'echo "Secret Data 123" > secret.txt', delay: 300 },
    { type: "command", text: "wit add .", delay: 400 },
    { type: "output", text: "added .gitignore", delay: 50 },
    { type: "output", text: "added .witignore", delay: 50 },
    { type: "output", text: "added secret.txt", delay: 50 },
    { type: "command", text: 'wit commit -m "Initial secret commit"', delay: 400 },
    { type: "success", text: "Committed sha256-W+WPtz4B/LgLPbgh/S1qM15Z5/C81NOEdpTWrdlvqdQ=", delay: 100 },
    { type: "command", text: "wit log", delay: 300 },
    { type: "output", text: "Local (HEAD):", delay: 100 },
    { type: "info", text: "commit sha256-W+WPtz4B/LgLPbgh/S1qM15Z5/C81NOEdpTWrdlvqdQ=", delay: 50 },
    { type: "output", text: "Author: 0x6aeef86d3cde2fff...089185f5b", delay: 50 },
    { type: "output", text: "Date:   2025-11-24T06:28:57.000Z", delay: 50 },
    { type: "output", text: "", delay: 20 },
    { type: "output", text: "    Initial secret commit", delay: 50 },
];

// Scene 3: Push 到链上 - 完整输出
export const pushLines: TerminalLine[] = [
    { type: "command", text: "wit push", delay: 300 },
    { type: "output", text: "Starting push...", delay: 200 },
    { type: "info", text: "Using account 0x5015865b7c0abbaeca0613bfd9e548dced7fcd41689c7a13cc9730481f90b1d8", delay: 100 },
    { type: "output", text: "  SUI: 615616394 (min 100000000)", delay: 50 },
    { type: "output", text: "  WAL: 467525000 (min 1000000000)", delay: 50 },
    { type: "warning", text: "Warning: WAL balance below threshold (1000000000 min).", delay: 100 },
    { type: "success", text: "Created on-chain repository 0xdd3c7f6cf6e374d245afd4e247ffccbe7f33a426ffe2b721904cd55a4a963d34", delay: 200 },
    { type: "success", text: "Seal policy updated from chain: 0x905d4f3559d418659f30aa4229a82ecafb2fc5ce3509c125c5d4da346264c38b", delay: 100 },
    { type: "output", text: "Commits to upload: 1", delay: 50 },
    { type: "output", text: "Uploading commit 1/1: sha256-W+WPtz4B/LgLPbgh/S1qM15Z5/C81NOEdpTWrdlvqdQ=", delay: 100 },
    { type: "output", text: "  Building and verifying file snapshot...", delay: 100 },
    { type: "output", text: "  Quilt uploaded: w5wwD018aM0p8oR-O5_IaewCRPYfSFyx_DN5ObrasF0", delay: 100 },
    { type: "output", text: "  File index written to Walrus", delay: 50 },
    { type: "output", text: "  Manifest uploaded: ZjKDAqxp5n18tk4GxCnPK3Wc3ZJAqN2PpOf6rPjm3WA", delay: 100 },
    { type: "output", text: "  Remote commit uploaded: SGqiDDHyH0cwTSwyEoIewG46j4LZVI7ILeDdnhkOX1Q", delay: 100 },
    { type: "success", text: "Uploaded commit sha256-W+WPtz4B/LgLPbgh/S1qM15Z5/C... -> SGqiDDHyH0cwTSwyEoIe...", delay: 100 },
    { type: "success", text: "On-chain head updated", delay: 50 },
    { type: "success", text: "Push complete", delay: 100 },
    { type: "info", text: "Remote head: SGqiDDHyH0cwTSwyEoIewG46j4LZVI7ILeDdnhkOX1Q", delay: 50 },
    { type: "info", text: "Manifest: ZjKDAqxp5n18tk4GxCnPK3Wc3ZJAqN2PpOf6rPjm3WA", delay: 50 },
    { type: "info", text: "Quilt: w5wwD018aM0p8oR-O5_IaewCRPYfSFyx_DN5ObrasF0", delay: 50 },
    { type: "success", text: "Initial push: repository created on chain and remote state recorded.", delay: 100 },
];

// Scene 4: Clone 仓库 - 在新的空目录 clone 项目
export const cloneLines: TerminalLine[] = [
    { type: "command", text: "tmp=$(mktemp -d) && cd \"$tmp\"", delay: 300 },
    { type: "command", text: "ls", delay: 300 },
    { type: "command", text: "wit clone 0xdd3c7f6cf6e374d245afd4e247ffccbe7f33a426ffe2b721904cd55a4a963d34", delay: 300 },
    { type: "output", text: "Starting clone...", delay: 200 },
    { type: "output", text: "Downloading manifest...", delay: 300 },
    { type: "output", text: "Downloading commit...", delay: 200 },
    { type: "output", text: "Downloading 3 files from Walrus...", delay: 400 },
    { type: "success", text: "Clone complete.", delay: 200 },
    { type: "info", text: "Head: SGqiDDHyH0cwTSwyEoIewG46j4LZVI7ILeDdnhkOX1Q", delay: 50 },
    { type: "info", text: "Manifest: ZjKDAqxp5n18tk4GxCnPK3Wc3ZJAqN2PpOf6rPjm3WA", delay: 50 },
    { type: "info", text: "Quilt: w5wwD018aM0p8oR-O5_IaewCRPYfSFyx_DN5ObrasF0", delay: 50 },
    { type: "command", text: "ls", delay: 400 },
    { type: "output", text: "secret.txt", delay: 100 },
];

// Scene 5: 邀请协作者
export const inviteLines: TerminalLine[] = [
    { type: "command", text: "wit invite 0x4437487fe62c8633a2b0707129f648a14603b1aa28ec2a239782dee8db69a9c9", delay: 300 },
    { type: "output", text: "Adding collaborator...", delay: 300 },
    { type: "success", text: "Added 0x4437487fe62c8633a2b0707129f648a14603b1aa28ec2a239782dee8db69a9c9 as collaborator.", delay: 200 },
    { type: "success", text: "User added to Whitelist (0x905d4f3559d418659f30aa4229a82ecafb2fc5ce3509c125c5d4da346264c38b).", delay: 100 },
    { type: "info", text: "They can now decrypt the repository.", delay: 100 },
];

// Scene 6: 列出仓库
export const listLines: TerminalLine[] = [
    { type: "command", text: "wit list", delay: 300 },
    { type: "output", text: "Listing repositories for 0x5015865b7c0abbaeca0613bfd9e548dced7fcd41689c7a13cc9730481f90b1d8...", delay: 200 },
    { type: "output", text: "┌─────────┬────────────────────────────────────────────┬──────────────┬─────────┐", delay: 50 },
    { type: "output", text: "│ (index) │                     id                     │     name     │  role   │", delay: 50 },
    { type: "output", text: "├─────────┼────────────────────────────────────────────┼──────────────┼─────────┤", delay: 50 },
    { type: "output", text: "│    0    │ '0x65e420985224f6e4ad46caf6ffd90f9a84...'  │ 'demo-repo'  │ 'Owner' │", delay: 50 },
    { type: "output", text: "│    1    │ '0xd3eadee3e384e883e7c14a61d14c9177b5...'  │ 'demo-repo'  │ 'Owner' │", delay: 50 },
    { type: "output", text: "│    2    │ '0xdd3c7f6cf6e374d245afd4e247ffccbe7f...'  │ 'demo-repo1' │ 'Owner' │", delay: 50 },
    { type: "output", text: "└─────────┴────────────────────────────────────────────┴──────────────┴─────────┘", delay: 50 },
];

// Scene 7: 账户管理
export const accountLines: TerminalLine[] = [
    { type: "command", text: "wit account list", delay: 300 },
    { type: "output", text: "  0x6aeef86d...089185f5b (default)", delay: 50 },
    { type: "success", text: "* 0x5015865b...81f90b1d8 (demo) ← active", delay: 50 },
    { type: "output", text: "  0x3a21f6be...f7d2f242 (demo1)", delay: 50 },
    { type: "command", text: "wit account balance", delay: 400 },
    { type: "output", text: "Account: 0x5015865b...81f90b1d8", delay: 100 },
    { type: "success", text: "SUI: 0.566 SUI (ok)", delay: 50 },
    { type: "warning", text: "WAL: 0.423 WAL (low)", delay: 50 },
    { type: "command", text: "wit account generate", delay: 400 },
    { type: "success", text: "Generated 0x25ad51b4...c8abd95c and set as active.", delay: 200 },
];

// wit log 输出
export const logLines: TerminalLine[] = [
    { type: "command", text: "wit log", delay: 300 },
    { type: "output", text: "Local (HEAD):", delay: 100 },
    { type: "info", text: "commit sha256-W+WPtz4B/LgLPbgh/S1qM15Z5/C81NOEdpTWrdlvqdQ=", delay: 50 },
    { type: "output", text: "Author: 0x6aeef86d3cde2fff14570e08d45c0e2e4363451fdb3f03f0b351477089185f5b", delay: 50 },
    { type: "output", text: "Date:   2025-11-24T06:28:57.000Z", delay: 50 },
    { type: "output", text: "", delay: 20 },
    { type: "output", text: "    Initial secret commit", delay: 50 },
    { type: "output", text: "", delay: 20 },
    { type: "info", text: "(remote id: SGqiDDHyH0cwTSwyEoIewG46j4LZVI7ILeDdnhkOX1Q)", delay: 50 },
];

// wit list 完整输出
export const listFullLines: TerminalLine[] = [
    { type: "command", text: "wit list", delay: 300 },
    { type: "output", text: "Listing repositories for 0x5015865b7c0abbaeca0613bfd9e548dced7fcd41689c7a...", delay: 200 },
    { type: "output", text: "┌─────────┬────────────────────────────────────────────────────────┬──────────────┬─────────┐", delay: 50 },
    { type: "output", text: "│ (index) │                          id                            │     name     │  role   │", delay: 50 },
    { type: "output", text: "├─────────┼────────────────────────────────────────────────────────┼──────────────┼─────────┤", delay: 50 },
    { type: "output", text: "│    0    │ '0x65e420985224f6e4ad46caf6ffd90f9a84b6cb3284...'     │ 'demo-repo'  │ 'Owner' │", delay: 50 },
    { type: "output", text: "│    1    │ '0xd3eadee3e384e883e7c14a61d14c9177b5edfffe02...'     │ 'demo-repo'  │ 'Owner' │", delay: 50 },
    { type: "output", text: "│    2    │ '0x036f32257a44688bda4a406ae61884268d4608e1...'       │ 'demo-repo'  │ 'Owner' │", delay: 50 },
    { type: "output", text: "│    3    │ '0x921507103f819125953d919f680e656e5578c4c8...'       │ 'demo-repo'  │ 'Owner' │", delay: 50 },
    { type: "success", text: "│    4    │ '0xdd3c7f6cf6e374d245afd4e247ffccbe7f33a426...'       │ 'demo-repo1' │ 'Owner' │", delay: 50 },
    { type: "output", text: "└─────────┴────────────────────────────────────────────────────────┴──────────────┴─────────┘", delay: 50 },
];

// 完整安装流程
export const installLines: TerminalLine[] = [
    { type: "command", text: "npm install -g withub-cli", delay: 300 },
    { type: "output", text: "", delay: 100 },
    { type: "output", text: "added 83 packages in 2s", delay: 200 },
    { type: "output", text: "", delay: 50 },
    { type: "output", text: "29 packages are looking for funding", delay: 100 },
    { type: "output", text: "  run `npm fund` for details", delay: 50 },
    { type: "success", text: "✓ Ready! Run `wit --help` to get started", delay: 200 },
];
