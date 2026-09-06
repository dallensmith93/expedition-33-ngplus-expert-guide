# Clair Obscur: Expedition 33 — NG+ Expert 100% Guide

**30 episodes. Base game + Thank You Update (through patch 1.5.5).**

## Field manual UI

Open [`ui/index.html`](ui/index.html) in a browser (double-click the file). No server required.

### Netlify

This repo is set to publish the `ui/` folder (`netlify.toml`).

1. Import **https://github.com/dallensmith93/expedition-33-ngplus-expert-guide** in Netlify.
2. Leave the build command as `node ui/build.mjs`.
3. Publish directory must be `ui`.
4. Deploy. The site root should load the field manual, not a 404.

If you edit episode markdown, rebuild the UI data:

```bash
node ui/build.mjs
```

## Markdown guide

Start here: [`guide/MASTER_GUIDE.md`](guide/MASTER_GUIDE.md)

Episode files: `guide/01-lumiere-the-gommage.md` through `guide/30-finale.md`

Research / audit: `research/`

**Rule this guide is built on:** everything reasonably possible is finished before you return to Lumière. Episode 29 is the audit. Episode 30 is the finale.
