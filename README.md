# LaTeX Studio Pro

A beautiful, modern web-based LaTeX editor customized for your research.

## Prerequisites

To compile PDFs, this application requires a local installation of `pdflatex`. Since it is not currently installed, please run the following command in your terminal to install the necessary LaTeX dependencies:

```bash
sudo apt update && sudo apt install -y texlive-latex-base texlive-fonts-recommended texlive-latex-extra latexmk
```

## Running the Application

This project consists of a React/Vite frontend and a Node.js Express backend.

### 1. Start the Backend Server
The backend serves your workspace files and compiles the LaTeX code.

```bash
cd backend
npm install
node server.js
```
The backend will run on `http://localhost:3001`.

### 2. Start the Frontend Application
The frontend is a modern web app with a split-pane layout and Monaco Editor.

```bash
cd frontend
npm install
npm run dev
```
The frontend will be available at `http://localhost:5173`.

## Features
- **Monaco Editor**: Powerful text editing with LaTeX syntax highlighting and shortcuts.
- **Auto-Save & Compile Shortcuts**: Use `Ctrl+S` to save and `Ctrl+Enter` to compile.
- **Modern UI**: Pure Vanilla CSS featuring a stunning dark mode with glassmorphism.
- **Live PDF Preview**: Compiles and automatically refreshes the embedded PDF.
