<div align="center">

# NoteLoop

## From Notes to Knowledge Gaps

*Compare course material with your notes, test uncertain areas, diagnose misconceptions, and patch only what is missing.*

<br>

**A browser-first AI study diagnostic tool that closes the loop between learning, testing, and note refinement.**

<br>

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Open-1f6feb?style=flat&logo=githubpages&logoColor=white)](https://rooney-yan.github.io/NoteLoop/)
![Stars](https://img.shields.io/github/stars/Rooney-YAN/NoteLoop?style=flat&logo=github)
![Forks](https://img.shields.io/github/forks/Rooney-YAN/NoteLoop?style=flat&logo=github)
![Next.js](https://img.shields.io/badge/Next.js-Latest-000000?style=flat&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178C6?style=flat&logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-Vitest-6E9F18?style=flat&logo=vitest&logoColor=white)

<br>

**Rooney YAN · 2026**

---

</div>

## Overview

**NoteLoop** is a browser-only study diagnostic demo.

Instead of simply summarizing a PDF or rewriting notes, it runs a structured loop:

```text
Course Material
      │
      ▼
Coverage Analysis
      │
      ▼
Targeted Quiz
      │
      ▼
Diagnosis
      │
      ▼
Minimal Markdown Patch
      │
      └──────────────► Improved Notes
```

The system compares source material against a student's existing notes, identifies uncertain or uncovered areas, generates a six-question diagnostic quiz, reviews that quiz, evaluates the answers, and returns only the smallest justified note changes.

## Why NoteLoop?

Most AI study tools are optimized for **generation**:

- summarize this PDF
- rewrite these notes
- explain this concept
- generate flashcards

NoteLoop is designed around **diagnosis** instead.

It asks:

> **What does the student already have, what is still uncertain, and what is the smallest useful update?**

That makes the workflow closer to an iterative learning loop than a one-shot note generator.

## Pipeline

### 1. Material Analysis

The source PDF is extracted locally in the browser and summarized independently.

### 2. Note Analysis

The student's notes are summarized separately, without assuming knowledge that was never written down.

### 3. Coverage Mapping

The two structured summaries are compared to identify covered, weak, and uncertain areas.

### 4. Quiz Generation + Review

NoteLoop creates exactly six diagnostic questions:

- 2 single-choice
- 2 multiple-choice
- 2 short-answer

A separate review pass audits and corrects the draft quiz before the student sees it.

### 5. Diagnosis

Choice questions are checked deterministically where possible, while model-based diagnosis is used for misconceptions, confidence, and short-answer evaluation.

### 6. Minimal Patch

Each result can produce one small Markdown patch:

- `ADD`
- `CORRECT`
- `CLARIFY`
- `NONE`

Patches can be copied, appended individually, applied in bulk, skipped, or undone. Existing notes are never silently overwritten.

## Privacy Model

NoteLoop is intentionally browser-first.

- API keys are kept in `sessionStorage` for the current tab
- closing the tab forgets the key
- PDF text extraction runs locally
- returned structured objects are validated locally with Zod

Because this is still a static browser application, it should be treated as a personal demo rather than a server-grade secret-management environment. Use temporary or restricted API keys on trusted devices.

## Supported Providers

The hosted demo currently includes presets for:

- **OpenAI**
- **DeepSeek**
- **OpenAI-compatible custom relays**

Provider-specific output modes are handled automatically, while all returned data still passes the same local schema validation.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js |
| UI | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| PDF parsing | unpdf |
| Validation | Zod |
| LLM SDK | OpenAI-compatible client |
| Testing | Vitest + Testing Library |
| Deployment | Static export + GitHub Pages |

These dependencies and scripts are defined in the repository package configuration.

## Local Development

Requirements:

- Node.js 20.9+
- pnpm

```bash
git clone https://github.com/Rooney-YAN/NoteLoop.git
cd NoteLoop

pnpm install
pnpm dev
```

Then open:

```text
http://localhost:3000
```

The repository also provides:

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

The production build is exported as a static site.

## Deployment

Every push to `main` can be deployed through the included GitHub Pages workflow.

Hosted version:

**https://rooney-yan.github.io/NoteLoop/**

The repository documents GitHub Actions as the Pages deployment source.

## Current Limitations

- No OCR for scanned PDFs
- No diagram or image understanding
- Browser-side prompts and criteria are visible in the static build
- API usage is billed by the selected provider
- Browser CORS restrictions still apply to custom providers

## Project Structure

```text
.
├── app/
├── components/
├── lib/
├── tests/
├── types/
├── .github/workflows/
├── .env.example
├── package.json
└── vitest.config.mts
```

## Design Principle

> **Do not rewrite everything. Diagnose first, then change only what the evidence justifies.**

That principle is the core of NoteLoop.

---

<div align="center">

**Learn → Test → Diagnose → Patch → Repeat**

</div>
