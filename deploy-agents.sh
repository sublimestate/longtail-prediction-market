#!/bin/bash
# Deploy Longtail agents to a fresh EC2 instance (Amazon Linux 2023 or Ubuntu)
# Usage:
#   1. Launch EC2 instance (t3.micro, Amazon Linux 2023 or Ubuntu 22.04)
#   2. SCP this script + credentials to the server:
#        scp -i your-key.pem deploy-agents.sh .env .openserv.json ec2-user@<IP>:~
#   3. SSH in and run:
#        chmod +x deploy-agents.sh && ./deploy-agents.sh

set -euo pipefail

echo "=== Longtail Agent Deployment ==="

# Detect OS
if command -v dnf &>/dev/null; then
  PKG="dnf"
elif command -v apt-get &>/dev/null; then
  PKG="apt-get"
  sudo apt-get update -y
else
  echo "Unsupported OS"; exit 1
fi

# Install git
if ! command -v git &>/dev/null; then
  echo "Installing git..."
  sudo $PKG install -y git
fi

# Install Node.js 22 via nvm
if ! command -v node &>/dev/null; then
  echo "Installing Node.js 22 via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm use 22
  nvm alias default 22
else
  echo "Node.js already installed: $(node -v)"
fi

# Ensure nvm is loaded
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Install pm2
if ! command -v pm2 &>/dev/null; then
  echo "Installing pm2..."
  npm install -g pm2
fi

# Clone repo
REPO_DIR="$HOME/longtail-prediction-market"
if [ ! -d "$REPO_DIR" ]; then
  echo "Cloning repository..."
  git clone https://github.com/sublimestate/longtail-prediction-market.git "$REPO_DIR"
else
  echo "Repo exists, pulling latest..."
  cd "$REPO_DIR" && git pull
fi

cd "$REPO_DIR"

# Copy credentials (must be in ~ from SCP step)
if [ -f "$HOME/.env" ]; then
  cp "$HOME/.env" "$REPO_DIR/.env"
  echo "Copied .env"
fi

if [ -f "$HOME/.openserv.json" ]; then
  cp "$HOME/.openserv.json" "$REPO_DIR/.openserv.json"
  echo "Copied .openserv.json"
fi

# Verify required files exist
if [ ! -f "$REPO_DIR/.env" ]; then
  echo "ERROR: .env not found. SCP it to ~/. env before running this script."
  exit 1
fi
if [ ! -f "$REPO_DIR/.openserv.json" ]; then
  echo "ERROR: .openserv.json not found. SCP it to ~/ before running this script."
  exit 1
fi

# Install agent dependencies
echo "Installing agent dependencies..."
cd "$REPO_DIR/agents"
npm install

# Create pm2 ecosystem file
cat > "$REPO_DIR/ecosystem.config.cjs" << 'ECOSYSTEM'
module.exports = {
  apps: [
    {
      name: 'market-maker',
      cwd: './agents',
      script: 'node_modules/.bin/tsx',
      args: 'src/market-maker/index.ts',
      env: { NODE_ENV: 'production' },
      restart_delay: 8000,
      max_restarts: 50,
      exp_backoff_restart_delay: 1000,
    },
    {
      name: 'contract-deployer',
      cwd: './agents',
      script: 'node_modules/.bin/tsx',
      args: 'src/contract-deployer/index.ts',
      env: { NODE_ENV: 'production' },
      restart_delay: 8000,
      max_restarts: 50,
      exp_backoff_restart_delay: 1000,
    },
    {
      name: 'resolution',
      cwd: './agents',
      script: 'node_modules/.bin/tsx',
      args: 'src/resolution/index.ts',
      env: { NODE_ENV: 'production' },
      restart_delay: 8000,
      max_restarts: 50,
      exp_backoff_restart_delay: 1000,
    },
  ],
};
ECOSYSTEM

echo "Created pm2 ecosystem config"

# Start agents with staggered launch (SIWE race condition)
cd "$REPO_DIR"
echo "Starting agents (staggered by 8s for SIWE auth)..."

pm2 start ecosystem.config.cjs --only market-maker
echo "Market Maker started. Waiting 8s..."
sleep 8

pm2 start ecosystem.config.cjs --only contract-deployer
echo "Contract Deployer started. Waiting 8s..."
sleep 8

pm2 start ecosystem.config.cjs --only resolution
echo "Resolution started."

# Save pm2 config for auto-restart on reboot
pm2 save
pm2 startup 2>&1 | grep "sudo" | bash 2>/dev/null || echo "Run the 'pm2 startup' command above manually if it failed."

echo ""
echo "========================================"
echo "  Longtail Agents — Deployment Complete"
echo "========================================"
echo ""
echo "Commands:"
echo "  pm2 status          # Check agent status"
echo "  pm2 logs            # Stream all logs"
echo "  pm2 logs resolution # Stream resolution agent logs"
echo "  pm2 restart all     # Restart all agents"
echo "  pm2 stop all        # Stop all agents"
echo ""
