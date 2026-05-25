# PRD: Timeout Proxy/Registry Troubleshooting Rule

## Goal

Capture the debugging rule learned from the PR #35 dependency install timeout: when any command times out, future sessions must treat proxy, network, or registry/source problems as the primary suspect before exploring other causes.

## Requirements

- Add a persistent Trellis guide for timeout troubleshooting.
- Make the rule visible from the thinking guide index.
- State the priority clearly: only move to non-network explanations after proxy/network/source health has been verified.

## Non-Goals

- Do not change application code.
- Do not change package manager configuration.
- Do not commit automatically.
