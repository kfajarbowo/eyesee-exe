#!/bin/bash
# deploy.sh - Deploy license server ke Proxmox
# Jalankan dari Windows PowerShell/Git Bash:
#   bash deploy.sh

# =====================================
# CONFIG - Sesuaikan ini!
# =====================================
PROXMOX_USER="root"
PROXMOX_IP="192.168.204.107"
REMOTE_DIR="/opt/license-server"
# =====================================

echo "🚀 Deploying License Server ke Proxmox ($PROXMOX_IP)..."

# 1. Transfer source code (bukan image!)
echo ""
echo "📦 Step 1: Transfer source code..."
ssh $PROXMOX_USER@$PROXMOX_IP "mkdir -p $REMOTE_DIR"

rsync -avz --exclude='node_modules' \
           --exclude='.env' \
           --exclude='data/' \
           --exclude='*.db' \
           ./ $PROXMOX_USER@$PROXMOX_IP:$REMOTE_DIR/

echo "✅ Source code transferred!"

# 2. Build & run di Proxmox
echo ""
echo "🔨 Step 2: Build & start container di Proxmox..."
ssh $PROXMOX_USER@$PROXMOX_IP "
    cd $REMOTE_DIR
    
    # Setup .env jika belum ada
    if [ ! -f .env ]; then
        cp .env.example .env
        echo '⚠️  .env dibuat dari example. Ganti ADMIN_PASSWORD!'
    fi
    
    # Build & run
    docker compose down
    docker compose up -d --build
    
    echo ''
    echo '📊 Container status:'
    docker compose ps
"

echo ""
echo "✅ Deploy selesai!"
echo ""
echo "🌐 Akses:"
echo "   Admin Panel : http://$PROXMOX_IP:3001"
echo "   Status API  : http://$PROXMOX_IP:3001/api/license/status"
