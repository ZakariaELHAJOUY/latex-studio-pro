const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const bodyParser = require('body-parser');
const multer = require('multer');
const os = require('os');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

const PROJECTS_ROOT = path.join(os.homedir(), 'LaTeX_Projects');
if (!fs.existsSync(PROJECTS_ROOT)) fs.mkdirSync(PROJECTS_ROOT, { recursive: true });

app.use(express.static(path.resolve(__dirname, '../frontend/dist')));
app.use('/workspace', express.static(PROJECTS_ROOT));

// ─── PROJECTS ────────────────────────────────────────
app.get('/api/projects', (req, res) => {
    try {
        const items = fs.readdirSync(PROJECTS_ROOT);
        const projects = items
            .filter(item => {
                const stat = fs.statSync(path.join(PROJECTS_ROOT, item));
                return stat.isDirectory() && !item.startsWith('.');
            })
            .map(name => {
                const projectPath = path.join(PROJECTS_ROOT, name);
                const files = fs.readdirSync(projectPath);
                const texFiles = files.filter(f => f.endsWith('.tex'));
                return { name, mainTex: texFiles[0] || null, fileCount: files.length };
            });
        res.json(projects);
    } catch (e) { res.status(500).json({ error: 'Failed to list projects' }); }
});

app.post('/api/projects', (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Project name required' });
    const safeName = name.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
    const projectPath = path.join(PROJECTS_ROOT, safeName);
    if (fs.existsSync(projectPath)) return res.status(409).json({ error: 'Project already exists' });
    fs.mkdirSync(projectPath, { recursive: true });
    const starterTex = `\\documentclass{article}
\\title{${name}}
\\author{Author Name}
\\date{\\today}
\\begin{document}
\\maketitle
\\section{Introduction}
Write your introduction here.
\\end{document}
`;
    fs.writeFileSync(path.join(projectPath, 'main.tex'), starterTex);
    res.json({ success: true, name: safeName, mainTex: 'main.tex' });
});

app.delete('/api/projects/:project', (req, res) => {
    const projectPath = path.join(PROJECTS_ROOT, req.params.project);
    if (!fs.existsSync(projectPath)) return res.status(404).json({ error: 'Project not found' });
    fs.rmSync(projectPath, { recursive: true, force: true });
    res.json({ success: true });
});

// ─── FILES ───────────────────────────────────────────
app.get('/api/projects/:project/files', (req, res) => {
    const projectPath = path.join(PROJECTS_ROOT, req.params.project);
    if (!fs.existsSync(projectPath)) return res.status(404).json({ error: 'Project not found' });
    try {
        const files = fs.readdirSync(projectPath)
            .filter(f => !f.startsWith('.'))
            .map(f => {
                const stat = fs.statSync(path.join(projectPath, f));
                return { name: f, isDirectory: stat.isDirectory(), size: stat.size };
            });
        res.json(files);
    } catch (e) { res.status(500).json({ error: 'Failed to read files' }); }
});

app.get('/api/projects/:project/files/:filename', (req, res) => {
    const filePath = path.join(PROJECTS_ROOT, req.params.project, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read file' });
        res.json({ content: data });
    });
});

app.post('/api/projects/:project/files/:filename', (req, res) => {
    const filePath = path.join(PROJECTS_ROOT, req.params.project, req.params.filename);
    const { content } = req.body;
    if (content === undefined) return res.status(400).json({ error: 'No content provided' });
    fs.writeFile(filePath, content, 'utf8', err => {
        if (err) return res.status(500).json({ error: 'Failed to save' });
        res.json({ success: true });
    });
});

app.delete('/api/projects/:project/files/:filename', (req, res) => {
    const filePath = path.join(PROJECTS_ROOT, req.params.project, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    fs.unlinkSync(filePath);
    res.json({ success: true });
});

// ─── UPLOAD ──────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const projectPath = path.join(PROJECTS_ROOT, req.params.project);
        if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
        cb(null, projectPath);
    },
    filename: (req, file, cb) => {
        // preserve original filename
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

app.post('/api/projects/:project/upload', upload.array('files'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }
    const uploaded = req.files.map(f => ({ name: f.originalname, size: f.size }));
    res.json({ success: true, files: uploaded });
});

// ─── UPLOAD ZIP PROJECT ──────────────────────────────
const uploadZip = multer({ dest: os.tmpdir() });

app.post('/api/projects/upload-zip', uploadZip.single('zipfile'), (req, res) => {
    const { projectName } = req.body;
    if (!projectName?.trim() || !req.file) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Project name and zip file required' });
    }
    const safeName = projectName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
    const projectPath = path.join(PROJECTS_ROOT, safeName);
    
    if (fs.existsSync(projectPath)) {
        fs.unlinkSync(req.file.path);
        return res.status(409).json({ error: 'Project already exists' });
    }
    
    fs.mkdirSync(projectPath, { recursive: true });
    
    const zipPath = req.file.path;
    const command = `unzip -q "${zipPath}" -d "${projectPath}"`;
    exec(command, (error, stdout, stderr) => {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); // clean up
        if (error) {
            fs.rmSync(projectPath, { recursive: true, force: true });
            return res.status(500).json({ error: 'Extraction failed', details: stderr });
        }
        res.json({ success: true, name: safeName });
    });
});

// ─── DOWNLOAD ZIP PROJECT ────────────────────────────
app.get('/api/projects/:project/download-zip', (req, res) => {
    const projectPath = path.join(PROJECTS_ROOT, req.params.project);
    if (!fs.existsSync(projectPath)) return res.status(404).json({ error: 'Project not found' });
    
    const zipName = `${req.params.project}.zip`;
    const zipPath = path.join(os.tmpdir(), zipName);
    
    // Create zip
    const command = `zip -r "${zipPath}" .`;
    exec(command, { cwd: projectPath }, (error) => {
        if (error) return res.status(500).json({ error: 'Compression failed' });
        res.download(zipPath, zipName, () => {
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        });
    });
});
app.post('/api/projects/:project/clean', (req, res) => {
    const projectPath = path.join(PROJECTS_ROOT, req.params.project);
    if (!fs.existsSync(projectPath)) return res.status(404).json({ error: 'Project not found' });
    const command = `latexmk -C`;
    exec(command, { cwd: projectPath }, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: 'Clean failed', details: stderr });
        res.json({ success: true });
    });
});

// ─── COMPILE ─────────────────────────────────────────
app.post('/api/compile', (req, res) => {
    const { project, filename } = req.body;
    if (!project || !filename?.endsWith('.tex')) {
        return res.status(400).json({ error: 'Valid project and .tex filename required' });
    }
    const projectPath = path.join(PROJECTS_ROOT, project);
    // Use -f to force, -synctex=1 for editor interaction, -bibtex to ensure bibtex is run
    const command = `latexmk -pdf -f -synctex=1 -interaction=nonstopmode "${filename}"`;
    exec(command, { cwd: projectPath }, (error, stdout, stderr) => {
        const pdfFilename = filename.replace('.tex', '.pdf');
        const pdfUrl = `http://localhost:${PORT}/workspace/${encodeURIComponent(project)}/${encodeURIComponent(pdfFilename)}`;
        
        // We return 200 even if there's an error because the PDF might still have been generated
        // and we want the user to see the logs.
        if (error) {
            return res.json({ success: false, error: 'Compilation had errors', logs: stdout + '\n' + stderr, pdfUrl });
        }
        res.json({ success: true, pdfUrl, logs: stdout });
    });
});

const server = app.listen(PORT, () => {
    console.log(`LaTeX Studio Pro backend: http://localhost:${PORT}`);
    console.log(`Projects root: ${PROJECTS_ROOT}`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use. Backend likely already running.`);
    } else {
        console.error('Backend server error:', e);
    }
});

