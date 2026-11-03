#!/usr/bin/env node
/**
 * Scaffold a new kit explainer and register it.
 *
 *   npm run new:explainer -- <id> [--title "Title"] [--locales en,vi]
 *
 * Creates src/explainers/<id>/ with a working one-lesson draft, then adds it
 * to src/explainers/index.ts. Open /<id>/ in `npm run dev` to see it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error("Usage: npm run new:explainer -- <kebab-case-id> [--title \"Title\"] [--locales en,vi]");
  process.exit(1);
}
if (id === "protocol") {
  console.error('"protocol" is reserved for the Protocol Explorer system.');
  process.exit(1);
}

const dir = join(root, "src/explainers", id);
if (existsSync(dir)) {
  console.error(`src/explainers/${id} already exists.`);
  process.exit(1);
}

const locales = opt("locales", "en,vi").split(",").map((s) => s.trim()).filter(Boolean);
const title = opt("title", id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
const varName = id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/^\d/, "_$&");
const T = (text) =>
  locales.length === 1
    ? JSON.stringify(text)
    : `{ ${locales.map((l) => `${/^[a-z]+$/.test(l) ? l : JSON.stringify(l)}: ${JSON.stringify(text)}`).join(", ")} }`;

const lesson = `import { defineLesson } from "../../../kit/define";

/**
 * TODO: replace the placeholder text. Each step changes the stage through
 * \`state\`: show / hide / update / highlight / flows / notes.
 * See docs/CONTENT_SCHEMA.md and .claude/skills/explainer-author/SKILL.md.
 */
export const firstLesson = defineLesson({
  id: "first-lesson",
  icon: "1",
  level: "beginner",
  minutes: 3,
  title: ${T("First lesson")},
  summary: ${T("One sentence: what the learner will understand.")},
  intro: { body: ${T("Why this matters, in two or three sentences.")} },
  stage: {
    type: "diagram",
    nodes: [
      { id: "a", x: 160, y: 225, icon: "🙂", label: ${T("Input")} },
      { id: "b", x: 400, y: 225, icon: "⚙️", tone: "violet", label: ${T("Process")} },
      { id: "c", x: 640, y: 225, icon: "📦", tone: "green", label: ${T("Output")}, hidden: true },
    ],
    edges: [
      { id: "ab", from: "a", to: "b" },
      { id: "bc", from: "b", to: "c", hidden: true },
    ],
  },
  steps: [
    {
      title: ${T("Start here")},
      body: ${T("Introduce the first actor.")},
      state: { highlight: ["a"] },
    },
    {
      title: ${T("Something moves")},
      body: ${T("Describe what travels and why.")},
      state: { highlight: ["ab", "b"], flows: [{ from: "a", to: "b", label: "data" }] },
    },
    {
      title: ${T("The result")},
      body: ${T("Reveal the outcome.")},
      state: { show: ["c", "bc"], highlight: ["c"], flows: [{ from: "b", to: "c", tone: "green" }] },
      quiz: {
        question: ${T("A question that checks the key idea?")},
        options: [${T("Wrong")}, ${T("Right")}],
        answer: 1,
      },
    },
  ],
  outro: { title: ${T("Recap")}, body: ${T("The one idea to remember.")} },
});
`;

const index = `import { defineExplainer } from "../../kit/define";
import { firstLesson } from "./lessons/first-lesson";

export default defineExplainer({
  id: ${JSON.stringify(id)},
  icon: "✨",
  accent: "violet",
  status: "draft",
  locales: ${JSON.stringify(locales)},
  title: ${T(title)},
  tagline: ${T("One short line")},
  description: ${T("Two sentences for the hub card.")},
  category: ${T("General")},
  lessons: [firstLesson],
});
`;

mkdirSync(join(dir, "lessons"), { recursive: true });
writeFileSync(join(dir, "index.ts"), index);
writeFileSync(join(dir, "lessons/first-lesson.ts"), lesson);

const registryPath = join(root, "src/explainers/index.ts");
let registry = readFileSync(registryPath, "utf8");
registry = registry
  .replace("// @explainer-imports", `import ${varName} from "./${id}";\n// @explainer-imports`)
  .replace("  // @explainer-list", `  ${varName},\n  // @explainer-list`);
writeFileSync(registryPath, registry);

console.log(`Created src/explainers/${id}/ and registered it.
Next:
  npm run dev        → http://localhost:3000/${id}/
  npm run validate   → check references and translations
Status is "draft": visible in dev, hidden from the production hub until you set "beta" or "stable".`);
