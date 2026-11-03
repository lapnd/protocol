import { defineLesson } from "../../../kit/define";

/** Commit graph: arrows point from a commit to its parent, as Git stores it. */
export const branches = defineLesson({
  id: "branches",
  group: "basics",
  icon: "2",
  level: "beginner",
  minutes: 5,
  title: { vi: "Nhánh chỉ là con trỏ", en: "A branch is just a pointer" },
  summary: {
    vi: "Vì sao tạo nhánh trong Git gần như miễn phí, và HEAD, merge thực sự làm gì.",
    en: "Why branching in Git is nearly free, and what HEAD and merge really do.",
  },
  intro: {
    body: {
      vi: "Nhiều người nghĩ nhánh là một bản sao của dự án. Thực ra nhánh chỉ là **một cái nhãn** dán lên một commit. Bài này cho bạn thấy nhãn đó di chuyển thế nào.",
      en: "Many people think a branch is a copy of the project. In fact a branch is just **a label** stuck on a commit. This lesson shows how that label moves.",
    },
  },
  stage: {
    type: "diagram",
    width: 800,
    height: 440,
    nodes: [
      { id: "c1", x: 120, y: 240, shape: "circle", tone: "slate", label: "C1" },
      { id: "c2", x: 260, y: 240, shape: "circle", tone: "slate", label: "C2" },
      { id: "c3", x: 400, y: 240, shape: "circle", tone: "slate", label: "C3" },
      { id: "c4", x: 550, y: 150, shape: "circle", tone: "violet", label: "C4", hidden: true },
      { id: "m", x: 690, y: 240, shape: "circle", tone: "green", label: "M", hidden: true },
      { id: "main", x: 400, y: 345, w: 110, shape: "pill", tone: "green", label: "main" },
      { id: "feature", x: 400, y: 135, w: 110, shape: "pill", tone: "violet", label: "feature", hidden: true },
      { id: "head", x: 400, y: 410, w: 90, h: 36, shape: "pill", tone: "amber", label: "HEAD" },
    ],
    edges: [
      { from: "c2", to: "c1" },
      { from: "c3", to: "c2" },
      { id: "e-c4", from: "c4", to: "c3", hidden: true },
      { id: "e-m1", from: "m", to: "c3", hidden: true },
      { id: "e-m2", from: "m", to: "c4", hidden: true },
      { id: "e-main", from: "main", to: "c3", dashed: true, tone: "green" },
      { id: "e-main-m", from: "main", to: "m", dashed: true, tone: "green", hidden: true },
      { id: "e-feat", from: "feature", to: "c3", dashed: true, tone: "violet", hidden: true },
      { id: "e-feat4", from: "feature", to: "c4", dashed: true, tone: "violet", hidden: true },
      { id: "e-head", from: "head", to: "main", dashed: true, tone: "amber" },
      { id: "e-head-f", from: "head", to: "feature", dashed: true, tone: "amber", hidden: true, curve: 60 },
    ],
  },
  legend: [
    { tone: "slate", label: { vi: "Commit (mũi tên chỉ về commit cha)", en: "Commit (arrow points to parent)" } },
    { tone: "green", label: { vi: "Nhánh main", en: "Branch main" } },
    { tone: "violet", label: { vi: "Nhánh feature", en: "Branch feature" } },
    { tone: "amber", label: { vi: "HEAD: bạn đang ở đâu", en: "HEAD: where you are" } },
  ],
  steps: [
    {
      title: { vi: "Chuỗi commit", en: "A chain of commits" },
      body: {
        vi: "Mỗi commit nhớ **commit cha** của nó. Ba commit C1 → C2 → C3 tạo thành lịch sử. Mũi tên chỉ ngược về quá khứ, vì commit mới biết commit cũ chứ không có chiều ngược lại.",
        en: "Every commit remembers its **parent**. Three commits C1 → C2 → C3 form the history. Arrows point back in time: a new commit knows the old one, never the other way round.",
      },
      state: { highlight: ["c1", "c2", "c3"], focus: true },
    },
    {
      title: { vi: "Nhánh = một nhãn", en: "Branch = a label" },
      body: {
        vi: "`main` không chứa file nào. Nó chỉ là một file nhỏ ghi mã của commit mới nhất: **C3**. **HEAD** cho biết bạn đang đứng ở nhánh nào.",
        en: "`main` contains no files. It is a tiny file holding the id of its newest commit: **C3**. **HEAD** says which branch you are on.",
      },
      state: { highlight: ["main", "e-main", "head", "e-head"] },
    },
    {
      title: { vi: "git branch feature", en: "git branch feature" },
      body: {
        vi: "Tạo nhánh mới chỉ là dán thêm một nhãn lên **cùng commit**. Không có file nào bị sao chép, nên dù dự án lớn cỡ nào cũng xong ngay lập tức.",
        en: "Creating a branch just sticks another label on **the same commit**. No files are copied, so it is instant however big the project is.",
      },
      facts: [[{ vi: "Kích thước", en: "Size" }, { vi: "41 byte (mã commit + xuống dòng)", en: "41 bytes (commit id + newline)" }]],
      state: {
        show: ["feature", "e-feat"],
        highlight: ["feature", "e-feat"],
      },
    },
    {
      title: { vi: "git switch feature", en: "git switch feature" },
      body: {
        vi: "Chuyển nhánh nghĩa là **HEAD** giờ trỏ vào `feature`. File trên đĩa không đổi, vì cả hai nhánh đang cùng ở C3.",
        en: "Switching means **HEAD** now points at `feature`. Files on disk do not change, because both branches sit on C3.",
      },
      state: {
        hide: ["e-head"],
        show: ["e-head-f"],
        update: { head: { x: 400, y: 75 } },
        highlight: ["head", "e-head-f"],
      },
    },
    {
      title: { vi: "Commit trên feature", en: "Commit on feature" },
      body: {
        vi: "Commit mới C4 có cha là C3. Nhánh đang đứng (`feature`) **tự dời** lên C4, còn `main` vẫn ở nguyên C3. Hai hướng phát triển đã tách ra.",
        en: "The new commit C4 has C3 as its parent. The current branch (`feature`) **moves forward** to C4, while `main` stays on C3. The two lines of work have split.",
      },
      state: {
        show: ["c4", "e-c4", "e-feat4"],
        hide: ["e-feat"],
        update: { feature: { x: 550, y: 75 }, head: { x: 550, y: 22 } },
        highlight: ["c4", "feature"],
      },
    },
    {
      title: { vi: "Merge: nối lại", en: "Merge: joining back" },
      body: {
        vi: "`git switch main` rồi `git merge feature`. Git tạo commit **M** có **hai cha** (C3 và C4), rồi dời `main` lên M. Lịch sử của cả hai nhánh được giữ nguyên.",
        en: "`git switch main` then `git merge feature`. Git creates commit **M** with **two parents** (C3 and C4) and moves `main` to M. Both histories are kept.",
      },
      detail: {
        vi: "Nếu `main` không có commit mới kể từ lúc tách nhánh, Git chỉ việc dời nhãn `main` lên C4 mà không tạo M. Đó gọi là **fast-forward**.",
        en: "If `main` had no new commits since the split, Git would just move the `main` label to C4 without creating M. That is called a **fast-forward**.",
      },
      state: {
        show: ["m", "e-m1", "e-m2", "e-head", "e-main-m"],
        hide: ["e-head-f", "e-main"],
        update: { main: { x: 690, y: 345 }, head: { x: 690, y: 410 } },
        highlight: ["m", "e-m1", "e-m2", "main"],
      },
      quiz: {
        question: { vi: "Xoá nhánh `feature` sau khi merge thì commit C4 có mất không?", en: "Does deleting `feature` after the merge lose commit C4?" },
        options: [
          { vi: "Có, C4 thuộc về nhánh feature", en: "Yes, C4 belongs to feature" },
          { vi: "Không, M vẫn trỏ tới C4 làm cha", en: "No, M still points to C4 as a parent" },
        ],
        answer: 1,
        explain: { vi: "Xoá nhánh chỉ là gỡ nhãn; commit vẫn còn trong lịch sử.", en: "Deleting a branch only removes a label; the commit stays in history." },
      },
    },
  ],
  outro: {
    title: { vi: "Nhánh rẻ, nên hãy dùng nhiều", en: "Branches are cheap, so use them" },
    body: {
      vi: "Commit là dữ liệu, nhánh là nhãn, HEAD là \"bạn đang ở đây\". Hiểu ba ý này là hiểu được hầu hết các lệnh Git khó như `rebase` hay `reset`.",
      en: "Commits are data, branches are labels, HEAD is \"you are here\". With those three ideas most hard Git commands such as `rebase` and `reset` make sense.",
    },
  },
  sources: [{ title: "Pro Git, ch. 3: Branches in a Nutshell", url: "https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell" }],
});
