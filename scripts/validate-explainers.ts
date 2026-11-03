/**
 * npm run validate [-- --strict] [-- <id>]
 *
 * Checks every kit explainer for broken references, bad quiz answers and
 * missing translations. Exits 1 on errors (or on warnings with --strict).
 * The same checks also run during `next build`.
 */
import { KIT_EXPLAINERS } from "../src/explainers";
import { validateExplainer } from "../src/kit/validate";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const only = args.filter((a) => !a.startsWith("--"));

let errors = 0;
let warnings = 0;
for (const explainer of KIT_EXPLAINERS) {
  if (only.length && !only.includes(explainer.id)) continue;
  const issues = validateExplainer(explainer);
  const steps = explainer.lessons.reduce((n, l) => n + l.steps.length, 0);
  const mark = issues.some((i) => i.level === "error") ? "✗" : issues.length ? "!" : "✓";
  console.log(`${mark} ${explainer.id}: ${explainer.lessons.length} lessons, ${steps} steps`);
  for (const issue of issues) {
    if (issue.level === "error") errors++;
    else warnings++;
    console.log(`    ${issue.level === "error" ? "error" : "warn "}  ${issue.where}: ${issue.message}`);
  }
}

console.log(`\n${errors} error(s), ${warnings} warning(s)`);
if (errors || (strict && warnings)) process.exit(1);
