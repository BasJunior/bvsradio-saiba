#!/bin/bash
# BVS Radio PWA Upload Script
# Uploads PWA files to IONOS server

# Configuration
HOST="access-5018934702.webspace-host.com"
PORT="22"
USER="su44623"
PASSWORD="Saiba2026!"
REMOTE_PATH="/home/www/bvsradio/BVSRadio/public/"

# Files to upload
FILES_TO_UPLOAD=(
    "manifest.json"
    "sw.js"
    "offline.html"
    "index.html"
    "radio.html"
    "shop.html"
    "assets/images/icon-192.png"
    "assets/images/icon-512.png"
)

echo "🚀 Starting BVS Radio PWA upload to IONOS..."
echo "📡 Host: $HOST"
echo "👤 User: $USER"
echo "📁 Remote Path: $REMOTE_PATH"
echo ""

# Check if sshpass is available
if ! command -v sshpass &> /dev/null; then
    echo "❌ Error: sshpass is not installed. Please install it first:"
    echo "   Ubuntu/Debian: sudo apt-get install sshpass"
    echo "   CentOS/RHEL: sudo yum install sshpass"
    echo "   macOS: brew install hudochenkov/sshpass/sshpass"
    exit 1
fi

# Upload each file
for file in "${FILES_TO_UPLOAD[@]}"; do
    local_path="/home/admin/.openclaw/workspace/bvsradio_html/$file"
    
    if [[ -f "$local_path" ]]; then
        echo "📤 Uploading: $file"
        sshpass -p "$PASSWORD" scp -P "$PORT" -o StrictHostKeyChecking=no "$local_path" "$USER@$HOST:$REMOTE_PATH"
        
        if [[ $? -eq 0 ]]; then
            echo "   ✅ Success"
        else
            echo "   ❌ Failed to upload $file"
        fi
    else
        echo "⚠️  Warning: Local file not found: $local_path"
    fi
done

echo ""
echo "✅ Upload process completed!"
echo ""
echo "🔍 Next steps - run these verification checks:"
echo "   curl -I https://bvsradio.com/manifest.json"
echo "   curl -I https://bvsradio.com/sw.js"
echo "   curl -I https://bvsradio.com/offline.html"
echo ""
echo "📱 Then test the PWA on your mobile device:"
echo "   1. Visit https://bvsradio.com"
echo "   2. Look for install option in browser menu"
echo "   3. Install to home screen"
echo "   4. Test offline functionality"