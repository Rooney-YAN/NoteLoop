# NoteLoop

NoteLoop is a browser-only study diagnostic demo. It compares a PDF with a student's notes, tests uncertain areas, diagnoses knowledge state, and returns a minimal Markdown patch.

## Use the hosted demo

Open the GitHub Pages site, choose **OpenAI official** or **DeepSeek official**, and enter the matching API key. The app fills the endpoint and model automatically:

```text
Base URL: https://api.openai.com/v1
Analysis model: gpt-4.1-mini
Diagnosis model: gpt-4.1-mini

DeepSeek Base URL: https://api.deepseek.com
DeepSeek model: deepseek-v4-flash
```

The key is stored only in `sessionStorage` for the current browser tab. Closing the tab forgets it. PDF extraction also runs locally in the browser; the source PDF is not uploaded as a file.

Model output compatibility is provider-aware and automatic. OpenAI uses strict Structured Outputs first. DeepSeek uses its supported JSON Object mode with thinking disabled for faster, more reliable structured responses. Custom relays try conservative OpenAI-compatible request variants. Every returned object must still pass the same local Zod validation before it is displayed.

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

### Provider troubleshooting

- **OpenAI official:** use an OpenAI key with the OpenAI preset. GPT-5.6-family models use `max_completion_tokens`; the default `gpt-4.1-mini` is the simplest demo option.
- **DeepSeek official:** use a DeepSeek key with the DeepSeek preset. Its Chat Completions endpoint supports `json_object`, not OpenAI's `json_schema`; NoteLoop also disables DeepSeek's default thinking mode for this structured extraction task.
- **Custom relay:** use the exact Base URL and model ID published by the relay. NoteLoop tries both common token-limit fields and progressively removes optional output-format parameters when the relay rejects them.
- HTTP 401/403 usually means a key or model-permission problem; 402 means insufficient credit; 404 means the endpoint or model name is unavailable; 413 means the input is too large; 429 means rate limiting; 5xx means a provider outage.
- A relay must allow browser CORS requests from `https://rooney-yan.github.io`. This cannot be repaired by static frontend code; choose another relay or a server-backed proxy if it blocks the origin.

## Limitations

- PDF text extraction does not include OCR or diagram/image understanding.
- Prompts and diagnostic reference criteria necessarily run in the browser in this static edition.
- API usage is billed by the provider associated with the key entered in the page.
