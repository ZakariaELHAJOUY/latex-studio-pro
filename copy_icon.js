const fs = require('fs');
const path = require('path');

const src = '/home/z-elhajouy/.gemini/antigravity/brain/44c773e0-b1f9-4ee5-869f-0336d2c0e79c/latex_studio_pro_icon_1777600782508.png';
const dests = [
    '/home/z-elhajouy/.gemini/antigravity/scratch/latex_editor_app/electron-app/icon.png',
    '/home/z-elhajouy/.gemini/antigravity/scratch/latex_editor_app/electron-app/build/icon.png'
];

dests.forEach(dest => {
    try {
        fs.copyFileSync(src, dest);
        console.log(`Copied to ${dest}`);
    } catch (err) {
        console.error(`Failed to copy to ${dest}:`, err);
    }
});
