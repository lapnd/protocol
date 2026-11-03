import type { LocaleCode, Text } from "./kit/types";

/**
 * Site-wide settings for the explainer hub. Change these when you fork the
 * template for your own collection of explainers.
 */
export const SITE = {
  name: "Explainer Lab",
  icon: "◆",
  tagline: {
    vi: "Hiểu mọi thứ, từng bước một",
    en: "Understand anything, one step at a time",
  } satisfies Text,
  intro: {
    vi: "Bộ sưu tập bài giải thích tương tác: mỗi chủ đề là một hệ thống nhỏ với sơ đồ chuyển động, lời giải thích theo từng bước và câu hỏi kiểm tra nhanh.",
    en: "A collection of interactive explainers: every topic is a small system with animated diagrams, step-by-step narration and quick checks.",
  } satisfies Text,
  description:
    "Interactive, step-by-step explainers: animated diagrams, narration and quizzes. Built from a reusable template.",
  /** Hub locales. The first one is the default. */
  locales: ["en", "vi"] as LocaleCode[],
  url: "https://example.com",
  repoUrl: "https://github.com/lapnd/protocol",
};
