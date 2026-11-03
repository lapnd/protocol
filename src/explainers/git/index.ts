import { defineExplainer } from "../../kit/define";
import { branches } from "./lessons/branches";
import { remotes } from "./lessons/remotes";
import { threeAreas } from "./lessons/three-areas";

export default defineExplainer({
  id: "git",
  icon: "🌿",
  accent: "green",
  status: "stable",
  category: { vi: "Lập trình", en: "Programming" },
  tags: ["git", "version control"],
  locales: ["en", "vi"],
  title: { vi: "Git từ bên trong", en: "Git from the inside" },
  tagline: { vi: "Commit, nhánh và làm việc nhóm", en: "Commits, branches and teamwork" },
  description: {
    vi: "Xem một thay đổi đi qua ba vùng của Git, nhánh di chuyển như con trỏ, và push/pull giữa các máy.",
    en: "Watch a change move through Git's three areas, branches move like pointers, and push/pull between machines.",
  },
  groups: [
    { id: "basics", title: { vi: "Cơ bản", en: "Basics" } },
    { id: "team", title: { vi: "Làm việc nhóm", en: "Teamwork" } },
  ],
  lessons: [threeAreas, branches, remotes],
  glossary: [
    {
      term: "commit",
      definition: { vi: "Ảnh chụp toàn bộ dự án kèm tác giả, thời gian và commit cha.", en: "A snapshot of the whole project plus author, time and parent." },
    },
    {
      term: "HEAD",
      definition: { vi: "Con trỏ cho biết bạn đang đứng ở nhánh/commit nào.", en: "The pointer to the branch or commit you are on." },
    },
    {
      term: "origin",
      definition: { vi: "Tên mặc định của kho từ xa mà bạn đã clone.", en: "Default name of the remote you cloned from." },
    },
  ],
});
