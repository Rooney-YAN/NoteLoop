# NoteLoop

NoteLoop is a browser-only study diagnostic demo. It compares a PDF with a student's notes, tests uncertain areas, diagnoses knowledge state, and returns a minimal Markdown patch.

## Use the hosted demo

Open the GitHub Pages site and enter an OpenAI-compatible API key. The default provider settings are:

```text
Base URL: https://api.openai.com/v1
Analysis model: gpt-4.1-mini
Diagnosis model: gpt-4.1-mini
```

The key is stored only in `sessionStorage` for the current browser tab. Closing the tab forgets it. PDF extraction also runs locally in the browser; the source PDF is not uploaded as a file.

Model output compatibility is automatic. The app tries strict Structured Outputs first, then falls back to JSON mode and finally prompt-only JSON for compatible providers that do not implement those extensions. Every returned object must still pass the same local Zod validation before it is displayed.

This browser-only design is intended for a personal demo. A browser cannot provide server-grade protection for API credentials, so use a temporary or restricted project key on a trusted device. Never hard-code a key or commit one to GitHub.

## Local development

Requirements: Node.js 20.9 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Static build

```bash
pnpm build
```

The export is written to `out/`. No Node.js server or environment variables are required after the build.

## GitHub Pages

The included workflow deploys every push to `main`. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**. The published site will be available at:

```text
https://rooney-yan.github.io/NoteLoop/
```

If the workflow reports `Get Pages site failed` or HTTP 404 in the **Configure Pages** step, Pages has not been enabled yet. Complete the one-time **Settings → Pages → Source → GitHub Actions** selection, then re-run the failed workflow.

The demo supports OpenAI and compatible providers that accept browser cross-origin requests. If a provider blocks browser requests, use a different compatible endpoint or switch back to a server-backed deployment.

## Limitations

- PDF text extraction does not include OCR or diagram/image understanding.
- Prompts and diagnostic reference criteria necessarily run in the browser in this static edition.
- API usage is billed by the provider associated with the key entered in the page.
