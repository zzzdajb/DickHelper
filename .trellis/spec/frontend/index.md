# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains guidelines for the new Electron-based DickHelper rewrite, informed by analysis of the old Web codebase. They describe the target architecture, conventions, and data migration strategy.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Filled |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | Filled |
| [State Management](./state-management.md) | Local state, global state, server state | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Filled |
| [Type Safety](./type-safety.md) | Type patterns, validation | Filled |
| [Data Migration](./data-migration.md) | Old version JSON import contract | Filled |
| [App Shell](./app-shell.md) | Layout, navbar, view switching (no Router) | Filled |
| [Code Style](./code-style.md) | C# / .NET style TypeScript conventions | Filled |

---

## Tech Stack (Target)

| Layer | Choice |
|-------|--------|
| Desktop Shell | Electron |
| Framework | React 19.2 |
| Language | TypeScript 5.9 (strict, C# style) |
| Build | Vite 6.3 + electron-vite |
| UI Library | Mantine 7 |
| Database | SQLite via sql.js (WASM) |
| Charts | Pure CSS heatmap (StatsChart.tsx) |
| State | SQLite + React state (no localStorage) |
| Routing | useState view switching (no Router) — see App Shell spec |

---

**Language**: Documentation in English. Code comments in Chinese (existing convention).
