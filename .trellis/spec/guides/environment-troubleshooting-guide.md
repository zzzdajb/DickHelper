# Environment Troubleshooting Guide

> **Purpose**: Keep command failures grounded in the local development environment before blaming project code.

---

## Timeout Rule

When any command times out, first assume a proxy, network, or registry/source problem until proven otherwise.

This applies to package installs, dependency download scripts, build tools that fetch assets, GitHub access, release tooling, and any command that touches a remote service.

Do not pivot to code-level explanations, broken scripts, or dependency bugs until proxy/network/source health has been checked and ruled out.

---

## Timeout Checklist

Before investigating other causes:

- [ ] Check whether the command downloads from the internet or a package/source registry
- [ ] Check current proxy environment variables and tool-specific proxy config
- [ ] Check whether the configured source/registry is reachable from the same shell
- [ ] Re-run with verbose logs so the blocked URL, package, or install script is visible
- [ ] Confirm the issue is not isolated to a registry mirror, CDN, or GitHub asset endpoint

Only after these checks pass should you consider local build scripts, package bugs, or code changes as the likely cause.

---

## Useful Commands

```powershell
npm config get registry
npm config get proxy
npm config get https-proxy
git config --global --get http.proxy
git config --global --get https.proxy
```

```powershell
npm ci --foreground-scripts --loglevel verbose --timing
```

---

## Good/Base/Bad Cases

- Good: `npm ci` times out, so first inspect proxy/registry/CDN access and run with verbose install-script logs.
- Base: A local-only command times out, so still check whether it spawned a child process that fetches remote assets.
- Bad: A dependency install times out and the investigation starts by rewriting project code or assuming the package is broken.
