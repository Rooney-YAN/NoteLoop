# NoteLoop

NoteLoop is a local-first study diagnostic app. It compares course material with a student's own notes, tests uncertain areas, diagnoses knowledge state, and returns only the smallest worthwhile Markdown patch. It does not generate replacement notes.

## Install

Requirements: Node.js 20.9 or newer.

```bash
pnpm install
```

Copy `.env.example` to `.env.local`, then configure one OpenAI-compatible provider. Keys stay on the server and are never sent to the browser.

## Environment configuration

```dotenv
LLM_API_KEY=your-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL_ANALYZE=gpt-4.1-mini
LLM_MODEL_DIAGNOSE=gpt-4.1-mini
LLM_JSON_MODE=true
```

The app uses the OpenAI JavaScript SDK's `chat.completions.create()` method, so the same variables can target official OpenAI, DeepSeek, or a compatible relay. `LLM_JSON_MODE=true` adds `{ "type": "json_object" }`; set it to `false` only for providers that reject that option. Each response is parsed and validated with Zod, with one repair retry for empty, invalid, or schema-mismatched output.

### DeepSeek example

```dotenv
LLM_API_KEY=your-deepseek-key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL_ANALYZE=deepseek-v4-pro
LLM_MODEL_DIAGNOSE=deepseek-v4-flash
LLM_JSON_MODE=true
```

Use model names enabled for your account if these example names are unavailable.

### Generic relay example

```dotenv
LLM_API_KEY=your-relay-key
LLM_BASE_URL=<provider-supplied-base-url>
LLM_MODEL_ANALYZE=provider/model-name
LLM_MODEL_DIAGNOSE=provider/model-name
LLM_JSON_MODE=true
```

## Run

```bash
pnpm dev
```

Open `http://localhost:3000`. In development only, if `LLM_API_KEY` is absent, NoteLoop uses deterministic demo responses so the complete UI can be tested without a paid call. Production builds never fall back to mock responses.

PDFs are text-extracted on the app server and are never uploaded as files to the LLM provider. This MVP does not include OCR or diagram/image understanding.
