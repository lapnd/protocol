import { defineLesson } from "../../../kit/define";

export const remotes = defineLesson({
  id: "remotes",
  group: "team",
  icon: "3",
  level: "intermediate",
  minutes: 4,
  title: { vi: "Làm việc nhóm: push & pull", en: "Teamwork: push & pull" },
  summary: {
    vi: "Máy bạn, GitHub và đồng đội trao đổi commit với nhau ra sao, và vì sao push đôi khi bị từ chối.",
    en: "How your laptop, GitHub and a teammate exchange commits, and why a push is sometimes rejected.",
  },
  stage: {
    type: "sequence",
    actors: [
      { id: "you", icon: "💻", tone: "blue", label: { vi: "Máy bạn", en: "Your laptop" } },
      { id: "origin", icon: "☁️", tone: "slate", label: "GitHub (origin)" },
      { id: "mate", icon: "🧑‍💻", tone: "violet", label: { vi: "Đồng đội", en: "Teammate" } },
    ],
  },
  legend: [
    { tone: "blue", label: { vi: "Bạn", en: "You" } },
    { tone: "violet", label: { vi: "Đồng đội", en: "Teammate" } },
    { tone: "red", label: { vi: "Bị từ chối", en: "Rejected" } },
  ],
  steps: [
    {
      title: { vi: "git clone", en: "git clone" },
      body: {
        vi: "`git clone` tải **toàn bộ lịch sử** về máy bạn, không chỉ phiên bản mới nhất. Từ đây bạn commit offline thoải mái.",
        en: "`git clone` downloads the **entire history**, not just the latest version. From now on you can commit offline.",
      },
      state: {
        messages: [
          { from: "you", to: "origin", label: "git clone" },
          { from: "origin", to: "you", label: { vi: "C1…C3 + nhánh", en: "C1…C3 + branches" }, dashed: true, tone: "slate" },
        ],
      },
    },
    {
      title: { vi: "git push", en: "git push" },
      body: {
        vi: "Bạn commit C4 rồi `git push`. GitHub nhận C4 và dời `main` của nó lên C4, vì C4 nối tiếp đúng từ commit nó đang có.",
        en: "You commit C4 and `git push`. GitHub receives C4 and moves its `main` to C4, because C4 builds directly on what it already has.",
      },
      state: {
        messages: [
          { from: "you", to: "you", label: "commit C4" },
          { from: "you", to: "origin", label: "git push (C4)" },
          { from: "origin", to: "you", label: "main → C4 ✓", dashed: true, tone: "green" },
        ],
      },
    },
    {
      title: { vi: "Đồng đội cũng push", en: "Your teammate pushes too" },
      body: {
        vi: "Đồng đội của bạn kéo C4 về, thêm C5 và push. Bây giờ GitHub có C5, còn máy bạn **chưa biết**.",
        en: "Your teammate pulls C4, adds C5 and pushes. GitHub now has C5, and your laptop **does not know yet**.",
      },
      state: {
        highlight: ["mate"],
        messages: [{ from: "mate", to: "origin", label: "git push (C5)", tone: "violet" }],
      },
    },
    {
      title: { vi: "Push bị từ chối", en: "Push rejected" },
      body: {
        vi: "Bạn commit C6 trên C4 rồi push. GitHub **từ chối**: nhận C6 sẽ làm mất C5 của đồng đội. Git không bao giờ tự ý ghi đè công việc của người khác.",
        en: "You commit C6 on top of C4 and push. GitHub **rejects** it: accepting C6 would throw away your teammate's C5. Git never silently overwrites someone else's work.",
      },
      state: {
        messages: [
          { from: "you", to: "origin", label: "git push (C6)", tone: "red", lost: true },
          { from: "origin", to: "you", label: "rejected: fetch first", tone: "red", dashed: true },
        ],
        notes: [{ at: "origin", text: { vi: "C6 không nối tiếp C5", en: "C6 does not build on C5" }, tone: "red" }],
      },
    },
    {
      title: { vi: "git pull rồi push lại", en: "git pull, then push again" },
      body: {
        vi: "`git pull` = tải C5 về (**fetch**) + gộp với C6 (**merge**). Lịch sử của bạn giờ chứa cả hai, nên lần push này thành công.",
        en: "`git pull` = download C5 (**fetch**) + combine it with C6 (**merge**). Your history now contains both, so this push succeeds.",
      },
      state: {
        messages: [
          { from: "you", to: "origin", label: "git pull" },
          { from: "origin", to: "you", label: "C5", dashed: true, tone: "violet" },
          { from: "you", to: "you", label: "merge C5 + C6" },
          { from: "you", to: "origin", label: "git push ✓", tone: "green" },
        ],
      },
    },
    {
      title: { vi: "Bảng tóm tắt", en: "Cheat sheet" },
      body: {
        vi: "Lệnh nào nói chuyện với máy chủ, lệnh nào chỉ chạy trên máy bạn?",
        en: "Which commands talk to the server, and which run only on your machine?",
      },
      visual: {
        type: "table",
        title: { vi: "Lệnh làm việc nhóm", en: "Team commands" },
        columns: [
          { vi: "Lệnh", en: "Command" },
          { vi: "Làm gì", en: "What it does" },
          { vi: "Cần mạng?", en: "Network?" },
        ],
        rows: [
          ["`git clone`", { vi: "Tải toàn bộ kho về", en: "Download the whole repository" }, "✓"],
          ["`git fetch`", { vi: "Tải commit mới, chưa gộp", en: "Download new commits, no merge" }, "✓"],
          ["`git pull`", { vi: "fetch + merge", en: "fetch + merge" }, "✓"],
          ["`git push`", { vi: "Gửi commit của bạn lên", en: "Upload your commits" }, "✓"],
          ["`git commit`", { vi: "Ghi ảnh chụp vào kho cục bộ", en: "Record a snapshot locally" }, "✗"],
        ],
      },
      state: { rows: [1, 2, 3] },
    },
  ],
  outro: {
    title: { vi: "Mỗi máy là một bản đầy đủ", en: "Every copy is complete" },
    body: {
      vi: "GitHub không đặc biệt gì cả: nó chỉ là một bản sao mà cả nhóm đồng ý dùng làm điểm hẹn. Push bị từ chối không phải lỗi, mà là Git đang bảo vệ công việc của đồng đội bạn.",
      en: "GitHub is nothing special: it is just a copy the team agrees to meet at. A rejected push is not an error; it is Git protecting your teammate's work.",
    },
  },
  sources: [{ title: "Pro Git, ch. 2.5: Working with Remotes", url: "https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes" }],
});
