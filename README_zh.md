<div align="center">

# NoteLoop

## 从笔记到知识盲区

*比较课程材料与已有笔记，测试不确定知识，诊断误区，并且只补充真正缺失的内容。*

<br>

**一个浏览器优先的 AI 学习诊断工具，把“学习—测试—诊断—修补”真正闭环起来。**

<br>

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Open-1f6feb?style=flat&logo=githubpages&logoColor=white)](https://rooney-yan.github.io/NoteLoop/)
![Stars](https://img.shields.io/github/stars/Rooney-YAN/NoteLoop?style=flat&logo=github)
![Forks](https://img.shields.io/github/forks/Rooney-YAN/NoteLoop?style=flat&logo=github)
![Next.js](https://img.shields.io/badge/Next.js-Latest-000000?style=flat&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178C6?style=flat&logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-Vitest-6E9F18?style=flat&logo=vitest&logoColor=white)

<br>

[**English**](README.md) · **中文**

<br><br>

**Rooney YAN · 2026**

---

</div>

## 项目简介

**NoteLoop** 是一个运行在浏览器中的 AI 学习诊断 Demo。

它不是单纯地总结 PDF 或重写笔记，而是围绕一个完整的诊断闭环运行：

```text
课程材料
   │
   ▼
覆盖度分析
   │
   ▼
针对性测验
   │
   ▼
知识诊断
   │
   ▼
最小化 Markdown 修补
   │
   └──────────────► 更完整的笔记
```

系统会比较课程原始材料与学生已有笔记，找到未覆盖、覆盖不足或理解不确定的部分，然后生成诊断性测验，并根据回答结果只返回必要的笔记更新。

## 为什么做 NoteLoop？

大多数 AI 学习工具更擅长做 **内容生成**：

- 总结 PDF
- 重写笔记
- 解释概念
- 生成闪卡

NoteLoop 更关注的是 **诊断**。

它真正想回答的问题是：

> **学生已经会了什么？哪里仍然不确定？最小但有效的补充是什么？**

因此，NoteLoop 更像一个持续迭代的学习闭环，而不是一次性的内容生成器。

## 工作流程

### 1. 材料分析

系统首先在浏览器中提取 PDF 内容，并独立分析课程材料。

### 2. 笔记分析

已有笔记会单独分析，不会把“原材料中出现过”错误地当成“学生笔记里已经掌握”。

### 3. 覆盖度映射

系统比较两个结构化结果，找出：

- 已覆盖内容
- 薄弱内容
- 未覆盖内容
- 不确定内容

### 4. 测验生成 + 审核

NoteLoop 固定生成 6 道诊断题：

- 2 道单选题
- 2 道多选题
- 2 道简答题

题目生成后，还会经过一个独立审核步骤，在展示给用户之前进行检查和修正。

### 5. 诊断

客观题尽量采用确定性规则检查；简答题、误区与信心水平则由模型进一步判断。

### 6. 最小化修补

每条诊断结果最多生成一个小型 Markdown 修改：

- `ADD`
- `CORRECT`
- `CLARIFY`
- `NONE`

用户可以：

- 单独复制
- 单独追加
- 批量应用
- 跳过
- 撤销

原笔记不会被静默覆盖。

## 隐私模型

NoteLoop 采用 browser-first 的实现方式：

- API Key 只保存在当前标签页的 `sessionStorage`
- 关闭标签页后 Key 会被遗忘
- PDF 文本提取在本地浏览器完成
- 模型返回的结构化数据会通过 Zod 在本地校验

需要注意的是，这仍然是一个静态前端 Demo，不应被当作服务器级别的密钥管理方案。

建议只在可信设备上使用临时或受限 API Key。

## 支持的模型提供商

当前版本支持：

- **OpenAI**
- **DeepSeek**
- **OpenAI-compatible 自定义接口**

不同 provider 的输出格式会被统一处理，并经过同一套本地 schema 校验。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 框架 | Next.js |
| UI | React |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| PDF 解析 | unpdf |
| 数据校验 | Zod |
| LLM SDK | OpenAI-compatible client |
| 测试 | Vitest + Testing Library |
| 部署 | Static Export + GitHub Pages |

## 本地开发

环境要求：

- Node.js 20.9+
- pnpm

```bash
git clone https://github.com/Rooney-YAN/NoteLoop.git
cd NoteLoop

pnpm install
pnpm dev
```

然后访问：

```text
http://localhost:3000
```

其他命令：

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## 部署

项目支持通过 GitHub Actions 部署到 GitHub Pages。

在线 Demo：

**https://rooney-yan.github.io/NoteLoop/**

## 当前限制

- 暂不支持扫描 PDF 的 OCR
- 暂不理解 PDF 中的图表与图片
- 静态前端中的 Prompt 与规则仍然可以被用户查看
- API 调用费用由用户选择的 provider 收取
- 自定义 provider 仍可能受到浏览器 CORS 限制

## 项目结构

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

## 核心设计原则

> **不要先重写全部笔记。先诊断，再只修改真正需要修改的地方。**

这就是 NoteLoop 的核心。

---

<div align="center">

**学习 → 测试 → 诊断 → 修补 → 再循环**

</div>
