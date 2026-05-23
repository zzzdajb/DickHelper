# Backend Development Guidelines

> Best practices for Electron main process development. This is the "backend" of the desktop app — SQLite persistence, IPC handlers, and system tray.

---

## Overview

The Electron main process is the backend layer:
- Holds the SQLite database connection (better-sqlite3)
- Creates and manages the BrowserWindow and system Tray
- Registers IPC handlers for all data operations
- Sends update notifications to the renderer process after mutations

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Main/preload module organization | Filled |
| [Database Guidelines](./database-guidelines.md) | SQLite setup, query patterns, date gotcha | Filled |
| [Error Handling](./error-handling.md) | IPC error propagation, import validation | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Forbidden/required patterns, IPC channel naming | Filled |
| [CI/CD Guidelines](./ci-github-actions.md) | GitHub Actions permissions, gh CLI rules, workflow patterns | Filled |
| [Logging Guidelines](./logging-guidelines.md) | Structured logging (N/A — no logging infra yet) | N/A |

---

## Tech Stack

| Component | Choice |
|-----------|--------|
| Runtime | Electron 35 |
| Database | SQLite via better-sqlite3 (synchronous) |
| IPC | ipcMain.handle / ipcRenderer.invoke |
| Security | contextIsolation + no nodeIntegration |
| Data format | ISO 8601 TEXT for dates |

---

**Language**: Documentation in English. Code identifiers in English (C# PascalCase style).
