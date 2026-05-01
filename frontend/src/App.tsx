import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import './index.css';

const API = 'http://localhost:3001/api';
const STATIC = 'http://localhost:3001/workspace';

type Project  = { name: string; mainTex: string | null; fileCount: number };
type FileInfo  = { name: string; isDirectory: boolean; size: number };
type Toast     = { message: string; type: 'success' | 'error'; id: number };

const ICONS: Record<string, string> = {
  '.tex':'📄','.bib':'📚','.pdf':'📕','.eps':'🖼️',
  '.sty':'⚙️','.cls':'⚙️','.png':'🖼️','.jpg':'🖼️',
  '.bst':'📑','.spl':'📋','.log':'🪵','.zip':'📦',
};
const getIcon  = (n: string) => { const e = n.substring(n.lastIndexOf('.')).toLowerCase(); return ICONS[e] ?? '📝'; };
const getLang  = (n: string) => n.endsWith('.tex') || n.endsWith('.sty') || n.endsWith('.cls') ? 'latex' : n.endsWith('.bib') || n.endsWith('.bst') ? 'bibtex' : 'plaintext';
const isBinary = (n: string) => ['.pdf','.eps','.png','.jpg','.jpeg','.zip'].some(e => n.toLowerCase().endsWith(e));

const TEX_CATEGORIES = ['.tex', '.cls', '.sty'];
const BIB_CATEGORIES = ['.bib', '.bst'];

function categoriseFiles(files: FileInfo[]) {
  const tex  = files.filter(f => TEX_CATEGORIES.some(e => f.name.endsWith(e)));
  const bib  = files.filter(f => BIB_CATEGORIES.some(e => f.name.endsWith(e)));
  const other = files.filter(f => !tex.includes(f) && !bib.includes(f));
  return { tex, bib, other };
}

export default function App() {
  // ── state ─────────────────────────────────────────
  const [projects,       setProjects]       = useState<Project[]>([]);
  const [activeProject,  setActiveProject]  = useState<Project | null>(null);
  const [files,          setFiles]          = useState<FileInfo[]>([]);
  const [activeFile,     setActiveFile]     = useState<string | null>(null);
  const [content,        setContent]        = useState('');
  const [pdfUrl,         setPdfUrl]         = useState<string | null>(null);
  const [isCompiling,    setIsCompiling]    = useState(false);
  const [isSaving,       setIsSaving]       = useState(false);
  const [compileLogs,    setCompileLogs]    = useState<string | null>(null);
  const [toasts,         setToasts]         = useState<Toast[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating,     setIsCreating]     = useState(false);
  const [dragOver,       setDragOver]       = useState(false);
  
  const [showUploadZip, setShowUploadZip] = useState(false);
  const [uploadZipName, setUploadZipName] = useState('');
  const [uploadZipFile, setUploadZipFile] = useState<File | null>(null);
  const [isUploadingZip, setIsUploadingZip] = useState(false);

  // Panel visibility toggles
  const [showProjects, setShowProjects] = useState(true);
  const [showFiles,    setShowFiles]    = useState(true);
  const [showPdf,      setShowPdf]      = useState(true);

  // Resizable PDF and Sidebar panes
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [pdfWidth, setPdfWidth]         = useState(420);
  const resizingSideRef                 = useRef(false);
  const resizingPdfRef                  = useRef(false);
  const workspaceRef                    = useRef<HTMLDivElement>(null);

  // ── resize logic ──────────────────────────────────
  const onPdfResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingPdfRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!resizingPdfRef.current || !workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const newW = rect.right - ev.clientX;
      setPdfWidth(Math.max(200, Math.min(newW, rect.width - 500)));
    };
    const onUp = () => {
      resizingPdfRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const onSidebarResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingSideRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!resizingSideRef.current || !workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const newW = ev.clientX - rect.left - (showProjects ? 260 : 0); // subtract project panel width if visible
      setSidebarWidth(Math.max(150, Math.min(newW, 500)));
    };
    const onUp = () => {
      resizingSideRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [showProjects]);

  // ── data fetching ────────────────────────────────
  const loadProjects = useCallback(async () => {
    try { const r = await axios.get(`${API}/projects`); setProjects(r.data); }
    catch { showToast('Failed to load projects', 'error'); }
  }, []);
  useEffect(() => { loadProjects(); }, [loadProjects]);

  const loadFiles = useCallback(async (projectName: string) => {
    try {
      const r = await axios.get(`${API}/projects/${projectName}/files`);
      setFiles(r.data); return r.data as FileInfo[];
    } catch { showToast('Failed to load files', 'error'); return []; }
  }, []);

  const selectProject = useCallback(async (p: Project) => {
    setActiveProject(p);
    setActiveFile(null); setContent(''); setPdfUrl(null); setCompileLogs(null);
    const projectFiles = await loadFiles(p.name);
    const tex = projectFiles.find(f => f.name === p.mainTex) ?? projectFiles.find(f => f.name.endsWith('.tex'));
    if (tex) openFile(p.name, tex.name);
    const pdfName = tex ? tex.name.replace('.tex', '.pdf') : null;
    if (pdfName && projectFiles.some(f => f.name === pdfName)) {
      setPdfUrl(`${STATIC}/${encodeURIComponent(p.name)}/${encodeURIComponent(pdfName)}?t=${Date.now()}`);
    }
  }, [loadFiles]);

  const openFile = async (projectName: string, filename: string) => {
    if (isBinary(filename)) {
      if (filename.endsWith('.pdf')) {
        setPdfUrl(`${STATIC}/${encodeURIComponent(projectName)}/${encodeURIComponent(filename)}?t=${Date.now()}`);
        setShowPdf(true);
      } else showToast('Cannot edit binary files', 'error');
      return;
    }
    try {
      const r = await axios.get(`${API}/projects/${projectName}/files/${encodeURIComponent(filename)}`);
      setContent(r.data.content); setActiveFile(filename); setCompileLogs(null);
    } catch { showToast('Failed to open file', 'error'); }
  };

  // ── save / compile ───────────────────────────────
  const save = useCallback(async () => {
    if (!activeProject || !activeFile) return;
    setIsSaving(true);
    try {
      await axios.post(`${API}/projects/${activeProject.name}/files/${encodeURIComponent(activeFile)}`, { content });
      showToast('Saved ✓', 'success');
    } catch { showToast('Save failed', 'error'); }
    finally { setIsSaving(false); }
  }, [activeProject, activeFile, content]);

  const compile = useCallback(async () => {
    if (!activeProject || !activeFile?.endsWith('.tex')) { showToast('Select a .tex file', 'error'); return; }
    await save();
    setIsCompiling(true); setCompileLogs(null);
    try {
      const r = await axios.post(`${API}/compile`, { project: activeProject.name, filename: activeFile });
      if (r.data.success) {
        showToast('Compiled successfully! ✓', 'success');
      } else {
        showToast('Compilation had warnings/errors', 'error');
      }
      setPdfUrl(`${r.data.pdfUrl}?t=${Date.now()}`);
      setShowPdf(true);
      if (r.data.logs) setCompileLogs(r.data.logs);
      await loadFiles(activeProject.name);
    } catch (err: any) {
      showToast('Backend error', 'error');
    }
    finally { setIsCompiling(false); }
  }, [activeProject, activeFile, save, loadFiles]);

  const cleanProject = useCallback(async () => {
    if (!activeProject) return;
    try {
      await axios.post(`${API}/projects/${activeProject.name}/clean`);
      showToast('Temporary files cleaned ✓', 'success');
      await loadFiles(activeProject.name);
    } catch { showToast('Clean failed', 'error'); }
  }, [activeProject, loadFiles]);

  // ── file upload ───────────────────────────────────
  const uploadFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || !activeProject) return;
    const form = new FormData();
    Array.from(fileList).forEach(f => form.append('files', f));
    try {
      const r = await axios.post(`${API}/projects/${activeProject.name}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast(`Uploaded ${r.data.files.length} file(s) ✓`, 'success');
      await loadFiles(activeProject.name);
    } catch { showToast('Upload failed', 'error'); }
  }, [activeProject, loadFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  // ── delete file ───────────────────────────────────
  const deleteFile = useCallback(async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    if (!activeProject || !window.confirm(`Delete "${filename}"?`)) return;
    try {
      await axios.delete(`${API}/projects/${activeProject.name}/files/${encodeURIComponent(filename)}`);
      showToast(`Deleted ${filename}`, 'success');
      if (activeFile === filename) { setActiveFile(null); setContent(''); }
      await loadFiles(activeProject.name);
    } catch { showToast('Delete failed', 'error'); }
  }, [activeProject, activeFile, loadFiles]);

  // ── create project ────────────────────────────────
  const createProject = async () => {
    if (!newProjectName.trim()) return;
    setIsCreating(true);
    try {
      const r = await axios.post(`${API}/projects`, { name: newProjectName.trim() });
      await loadProjects();
      setShowNewProject(false); setNewProjectName('');
      showToast(`Created "${r.data.name}"`, 'success');
      const p: Project = { name: r.data.name, mainTex: r.data.mainTex, fileCount: 1 };
      selectProject(p);
    } catch (err: any) { showToast(err.response?.data?.error ?? 'Failed', 'error'); }
    finally { setIsCreating(false); }
  };

  const deleteProject = async (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    if (!window.confirm(`Delete project "${p.name}"?`)) return;
    try {
      await axios.delete(`${API}/projects/${p.name}`);
      showToast(`Deleted "${p.name}"`, 'success');
      if (activeProject?.name === p.name) { setActiveProject(null); setFiles([]); setActiveFile(null); setContent(''); setPdfUrl(null); }
      loadProjects();
    } catch { showToast('Delete failed', 'error'); }
  };

  // ── upload zip project ────────────────────────────
  const uploadZipProject = async () => {
    if (!uploadZipName.trim() || !uploadZipFile) return;
    setIsUploadingZip(true);
    const form = new FormData();
    form.append('zipfile', uploadZipFile);
    form.append('projectName', uploadZipName.trim());
    try {
      const r = await axios.post(`${API}/projects/upload-zip`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await loadProjects();
      setShowUploadZip(false); setUploadZipName(''); setUploadZipFile(null);
      showToast(`Uploaded project "${r.data.name}"`, 'success');
      const projectFiles = await loadFiles(r.data.name);
      const tex = projectFiles.find(f => f.name.endsWith('.tex'));
      const p: Project = { name: r.data.name, mainTex: tex?.name ?? null, fileCount: projectFiles.length };
      selectProject(p);
    } catch (err: any) { showToast(err.response?.data?.error ?? 'Upload failed', 'error'); }
    finally { setIsUploadingZip(false); }
  };

  // ── keyboard shortcuts ────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); compile(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [save, compile]);

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(p => [...p, { message, type, id }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };

  const { tex, bib, other } = categoriseFiles(files);

  const renderFileGroup = (label: string, group: FileInfo[]) =>
    group.length > 0 ? (
      <>
        <div className="file-group-header">{label}</div>
        {group.map(f => (
          <div key={f.name}
            className={`file-item ${activeFile === f.name ? 'active' : ''}`}
            onClick={() => activeProject && openFile(activeProject.name, f.name)}>
            <span className="file-icon">{getIcon(f.name)}</span>
            <span className="file-name">{f.name}</span>
            <div className="file-actions">
              <a href={`${STATIC}/${encodeURIComponent(activeProject!.name)}/${encodeURIComponent(f.name)}`} 
                 download={f.name}
                 className="file-icon-btn" 
                 onClick={e => e.stopPropagation()} 
                 title="Download">⬇</a>
              <button className="file-delete-btn" onClick={e => deleteFile(e, f.name)} title="Delete">✕</button>
            </div>
          </div>
        ))}
      </>
    ) : null;

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <span className="logo">LaTeX Studio Pro</span>
          {activeProject && <span className="active-project-badge">Project: {activeProject.name.replace(/_/g, ' ')}</span>}
        </div>
        <div className="header-actions">
          {/* Panel visibility toggles */}
          <div className="panel-toggle-group">
            <button className={`panel-toggle-btn ${showProjects ? 'active' : ''}`} onClick={() => setShowProjects(v => !v)}>Projects</button>
            <button className={`panel-toggle-btn ${showFiles ? 'active' : ''}`} onClick={() => setShowFiles(v => !v)}>Files</button>
            <button className={`panel-toggle-btn ${showPdf ? 'active' : ''}`} onClick={() => setShowPdf(v => !v)}>PDF</button>
          </div>
          <button className="btn btn-ghost" onClick={cleanProject} disabled={!activeProject}>
            🧹 Clean
          </button>
          <button className="btn btn-ghost" onClick={save} disabled={!activeFile || isSaving}>
            {isSaving ? '⏳' : '💾'} Save
          </button>
          <button className="btn btn-primary" onClick={compile} disabled={!activeFile?.endsWith('.tex') || isCompiling}>
            {isCompiling ? '⏳ Compiling…' : '▶ Compile'}
          </button>
        </div>
      </header>

      <div className="workspace" ref={workspaceRef}>
        {/* ── Projects Panel ── */}
        <div className={`projects-panel ${showProjects ? '' : 'collapsed'}`}>
          <div className="panel-header">
            <span className="panel-title">Projects</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="btn btn-ghost" style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                onClick={() => setShowUploadZip(true)}>+ ZIP</button>
              <button className="btn btn-ghost" style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                onClick={() => setShowNewProject(true)}>+ New</button>
            </div>
          </div>
          <div className="project-list">
            {projects.length === 0
              ? <div className="empty-state">No projects.<br />Click "+ New" to start.</div>
              : projects.map(p => (
                <div key={p.name}
                  className={`project-card ${activeProject?.name === p.name ? 'active' : ''}`}
                  onClick={() => selectProject(p)}>
                  <span className="project-icon">🗂</span>
                  <div className="project-info">
                    <div className="project-name">{p.name.replace(/_/g, ' ')}</div>
                    <div className="project-meta">{p.fileCount} files · {p.mainTex ?? 'no .tex'}</div>
                  </div>
                  <div className="project-actions">
                    <a href={`${API}/projects/${p.name}/download-zip`} 
                       download={`${p.name}.zip`}
                       className="project-download-btn" 
                       onClick={e => e.stopPropagation()} 
                       title="Download ZIP Project">📦</a>
                    <button className="project-delete-btn" onClick={e => deleteProject(e, p)}>✕</button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* ── File Sidebar ── */}
        <aside className={`sidebar ${showFiles ? '' : 'collapsed'}`} style={{ width: showFiles ? sidebarWidth : 0 }}>
          <div className="panel-header">
            <span className="panel-title">{activeProject ? activeProject.name.replace(/_/g, ' ') : 'Files'}</span>
          </div>
          <div className="file-list">
            {!activeProject
              ? <div className="empty-state">Select a project</div>
              : files.length === 0
                ? <div className="empty-state">No files</div>
                : <>
                    {renderFileGroup('LaTeX', tex)}
                    {renderFileGroup('Bibliography', bib)}
                    {renderFileGroup('Assets & Other', other)}
                  </>
            }
          </div>
          {/* Upload zone */}
          {activeProject && (
            <label
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}>
              <input type="file" multiple onChange={e => uploadFiles(e.target.files)} />
              ⬆ Upload files
            </label>
          )}
        </aside>

        {/* ── Resize handle Left ── */}
        {showFiles && (
          <div className={`resize-handle ${resizingSideRef.current ? 'resizing' : ''}`} onMouseDown={onSidebarResizeMouseDown} />
        )}

        {/* ── Editor ── */}
        <main className="editor-pane">
          <div className="tab-bar">
            {activeFile
              ? <div className="tab active">{getIcon(activeFile)} {activeFile}</div>
              : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No file open</span>
            }
          </div>
          <div className="editor-wrapper">
            {activeFile
              ? <Editor height="100%" language={getLang(activeFile)} theme="vs-dark"
                  value={content} onChange={v => v !== undefined && setContent(v)}
                  options={{ wordWrap: 'on', minimap: { enabled: false }, fontSize: 14, lineHeight: 24,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace", padding: { top: 12 }, scrollBeyondLastLine: false }} />
              : <div className="empty-state" style={{ paddingTop: '5rem' }}>
                  {activeProject ? 'Select a file to edit' : 'Open or create a project to get started'}
                </div>
            }
          </div>
          {compileLogs && <div className="error-logs">{compileLogs}</div>}
          {isCompiling && <div className="overlay"><div className="spinner" /><span className="overlay-text">Compiling LaTeX…</span></div>}
        </main>

        {/* ── Resize handle Right ── */}
        {showPdf && (
          <div className={`resize-handle ${resizingPdfRef.current ? 'resizing' : ''}`} onMouseDown={onPdfResizeMouseDown} />
        )}

        {/* ── PDF Pane ── */}
        <div className={`pdf-pane ${showPdf ? '' : 'collapsed'}`} style={{ width: showPdf ? pdfWidth : 0 }}>
          <div className="pdf-toolbar">
            <span>PDF Preview</span>
            {pdfUrl && <a href={pdfUrl} download style={{ color: 'var(--accent)', fontSize: '0.72rem', textDecoration: 'none' }}>⬇ Download</a>}
          </div>
          {pdfUrl
            ? <iframe src={pdfUrl} className="pdf-viewer" title="PDF Preview" />
            : <div className="pdf-empty"><div className="pdf-empty-icon">📄</div><span>Compile to see preview</span></div>
          }
        </div>
      </div>

      {/* ── New Project Modal ── */}
      {showNewProject && (
        <div className="modal-backdrop" onClick={() => setShowNewProject(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Project</h2>
            <input type="text" placeholder="Project name (e.g. My Research Paper)"
              value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProject()} autoFocus />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowNewProject(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createProject} disabled={isCreating || !newProjectName.trim()}>
                {isCreating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload ZIP Modal ── */}
      {showUploadZip && (
        <div className="modal-backdrop" onClick={() => setShowUploadZip(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Upload ZIP Project</h2>
            <input type="text" placeholder="Project name (e.g. My Research Paper)"
              value={uploadZipName} onChange={e => setUploadZipName(e.target.value)} autoFocus />
            <input type="file" accept=".zip" onChange={e => setUploadZipFile(e.target.files?.[0] ?? null)} 
              style={{ marginTop: '0.5rem', marginBottom: '0.5rem', width: '100%' }} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowUploadZip(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={uploadZipProject} disabled={isUploadingZip || !uploadZipName.trim() || !uploadZipFile}>
                {isUploadingZip ? 'Uploading…' : 'Upload & Extract'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      <div style={{ position: 'fixed', bottom: '1.25rem', right: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', zIndex: 300 }}>
        {toasts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>)}
      </div>
    </div>
  );
}
