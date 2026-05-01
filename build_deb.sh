#!/bin/bash
NODE_EXE="/home/z-elhajouy/.nvm/versions/node/v20.20.2/bin/node"
export PATH="/home/z-elhajouy/.nvm/versions/node/v20.20.2/bin:$PATH"
NPM_CLI="/home/z-elhajouy/.nvm/versions/node/v20.20.2/lib/node_modules/npm/bin/npm-cli.js"

echo "Starting final .deb build (Node v20)..."

cd /home/z-elhajouy/.gemini/antigravity/scratch/latex_editor_app/electron-app

# Run electron-builder build
$NODE_EXE $NPM_CLI run build

if [ $? -eq 0 ]; then
    echo "DEB Build success!"
    echo "Location: $(pwd)/dist/latex-studio-pro_1.0.0_amd64.deb"
else
    echo "DEB Build failed."
fi

