
#!/bin/bash
set -e

# Path to the source code entry point
CLI_PATH="$(pwd)/wit/cli/src/index.ts"
EXEC_CMD="npx ts-node $CLI_PATH"

TEST_ROOT="temp_mantle_test_$(date +%s)"
mkdir -p "$TEST_ROOT"
cd "$TEST_ROOT"

echo "📂 Created test directory: $TEST_ROOT"
echo "🚀 Initializing repo 'my-private-repo' on Mantle..."

# 1. Set Chain to Mantle
$EXEC_CMD chain use mantle

# 2. Initialize as Private
echo "🚀 Initializing repo 'my-private-repo' on Mantle (Private)..."
mkdir -p my-private-repo
cd my-private-repo
$EXEC_CMD init my-private-repo --private

cat .wit/config.json
echo "🔒 Configured as private repository."

# 3. Create Content
SECRET_MSG="This is a super secret message verified on Mantle Mainnet at $(date)"
echo "$SECRET_MSG" > secret.txt

$EXEC_CMD add secret.txt
$EXEC_CMD commit -m "Add secret file"

# 4. Push (Triggers Encryption)
echo "⬆️ Pushing to Mantle Mainnet..."
$EXEC_CMD push

# Get Repo ID from config to clone
REPO_ID=$(node -e 'console.log(JSON.parse(fs.readFileSync(".wit/config.json")).repo_id)')
echo "🆔 Repo ID: $REPO_ID"

cd ..

# 5. Clone (Triggers Decryption)
echo "⬇️ Cloning repo $REPO_ID..."
$EXEC_CMD clone "$REPO_ID" my-cloned-repo

# 6. Verify Content
echo "🧐 Verifying decrypted content..."
DECRYPTED_MSG=$(cat my-cloned-repo/secret.txt)

if [ "$DECRYPTED_MSG" == "$SECRET_MSG" ]; then
    echo "✅ SUCCESS! Content matches:"
    echo "Original:  $SECRET_MSG"
    echo "Decrypted: $DECRYPTED_MSG"
    exit 0
else
    echo "❌ FAILURE! Content mismatch:"
    echo "Original:  $SECRET_MSG"
    echo "Decrypted: $DECRYPTED_MSG"
    exit 1
fi
