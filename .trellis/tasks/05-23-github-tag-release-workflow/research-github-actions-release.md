# GitHub Actions release workflow notes

* `actions/setup-node` supports npm caching keyed from the dependency lockfile, and the official guidance still expects committed lockfiles with `npm ci`.
* `actions/upload-artifact@v4` is the current artifact upload action, but release assets can also be uploaded directly with `gh release create`.
* GitHub CLI `gh release create <tag> <asset>` can create a release for an existing tag and upload files in one command. `--verify-tag` avoids accidentally creating a release from a missing tag.
* A workflow that creates releases needs `contents: write` permission for `GITHUB_TOKEN`.

References:

* https://github.com/actions/setup-node
* https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts
* https://cli.github.com/manual/gh_release_create
