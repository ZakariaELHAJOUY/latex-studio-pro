#!/bin/bash
NODE_EXE="/home/z-elhajouy/.nvm/versions/node/v20.20.2/bin/node"
export PATH="/home/z-elhajouy/.nvm/versions/node/v20.20.2/bin:$PATH"
BASE_DIR="/home/z-elhajouy/.gemini/antigravity/scratch/latex_editor_app"
NPM_CLI="/home/z-elhajouy/.nvm/versions/node/v20.20.2/lib/node_modules/npm/bin/npm-cli.js"

echo "🎨 Setting up premium branding (Node v20)..."

mkdir -p "$BASE_DIR/electron-app/build"

# Use the specific icon path found in the conversation logs
ICON_PATH="/home/z-elhajouy/.gemini/antigravity/brain/44c773e0-b1f9-4ee5-869f-0336d2c0e79c/latex_studio_pro_icon_1777600782508.png"
if [ -f "$ICON_PATH" ]; then
    cp "$ICON_PATH" "$BASE_DIR/electron-app/build/icon.png"
    cp "$ICON_PATH" "$BASE_DIR/electron-app/build/latex-studio-pro.png"
    cp "$ICON_PATH" "$BASE_DIR/electron-app/icon.png"
    # For Linux compatibility
    mkdir -p "$BASE_DIR/electron-app/build/icons"
    cp "$ICON_PATH" "$BASE_DIR/electron-app/build/icons/512x512.png"
fi




echo "🏗️ Rebuilding Premium Frontend..."
cd "$BASE_DIR/frontend"
$NODE_EXE node_modules/vite/bin/vite.js build
cp -r dist/* ../electron-app/frontend/dist/

echo "📦 Building Final One-Click .deb Package..."
cd "$BASE_DIR/electron-app"
$NODE_EXE $NPM_CLI run build

if [ $? -eq 0 ]; then
    echo "✨ SUCCESS! Premium .deb package is ready."
    echo "Location: $(pwd)/dist/latex-studio-pro_1.0.0_amd64.deb"
else
    echo "❌ Build failed."
fi

