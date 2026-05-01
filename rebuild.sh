#!/bin/bash
NODE_EXE="/home/z-elhajouy/.nvm/versions/node/v20.20.2/bin/node"
export PATH="/home/z-elhajouy/.nvm/versions/node/v20.20.2/bin:$PATH"


echo "🚀 Starting build with Node v24 (Playwright runtime)..."

# 1. Frontend Build
cd /home/z-elhajouy/.gemini/antigravity/scratch/latex_editor_app/frontend
$NODE_EXE node_modules/vite/bin/vite.js build

if [ $? -eq 0 ]; then
    echo "✅ Build success. Syncing files..."
    cp -r dist/* ../electron-app/frontend/dist/
    
    echo "🔄 Restarting Backend Server..."
    fuser -k 3001/tcp || true
    
    cd ../electron-app
    # Start in background using v24
    $NODE_EXE backend/server.js &
    echo "✨ Done! Refresh your app at http://localhost:3001"
else
    echo "❌ Build failed with Node v24."
fi

