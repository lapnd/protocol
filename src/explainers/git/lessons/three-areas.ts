import { defineLesson } from "../../../kit/define";

export const threeAreas = defineLesson({
  id: "three-areas",
  group: "basics",
  icon: "1",
  level: "beginner",
  minutes: 4,
  title: { vi: "Ba vùng của Git", en: "Git's three areas" },
  summary: {
    vi: "Một thay đổi đi từ thư mục làm việc, qua vùng staging, rồi vào kho lưu trữ như thế nào.",
    en: "How a change travels from your working directory, through staging, into the repository.",
  },
  intro: {
    body: {
      vi: "Git không lưu file mỗi khi bạn bấm Save. Nó chỉ ghi lại khi bạn **yêu cầu**, và mỗi lần ghi là một **ảnh chụp (snapshot)** toàn bộ dự án.\n\nĐể hiểu Git, chỉ cần nhớ ba nơi một file có thể nằm.",
      en: "Git does not save files whenever you hit Save. It records only when you **ask**, and every record is a **snapshot** of the whole project.\n\nTo understand Git you only need to know the three places a file can live.",
    },
    facts: [
      [{ vi: "Lệnh chính", en: "Key commands" }, "`git add`, `git commit`, `git restore`"],
      [{ vi: "Thời gian", en: "Time" }, { vi: "~4 phút", en: "~4 min" }],
    ],
  },
  stage: {
    type: "diagram",
    width: 800,
    height: 420,
    nodes: [
      {
        id: "wd",
        x: 130,
        y: 200,
        w: 170,
        h: 70,
        icon: "📁",
        tone: "blue",
        label: { vi: "Thư mục làm việc", en: "Working directory" },
        sublabel: { vi: "file bạn đang sửa", en: "files you edit" },
      },
      {
        id: "index",
        x: 400,
        y: 200,
        w: 170,
        h: 70,
        icon: "📋",
        tone: "amber",
        label: { vi: "Vùng staging", en: "Staging area" },
        sublabel: { vi: "bản nháp commit kế tiếp", en: "draft of the next commit" },
      },
      {
        id: "repo",
        x: 670,
        y: 200,
        w: 170,
        h: 80,
        icon: "🗄",
        tone: "green",
        shape: "db",
        label: { vi: "Kho .git", en: ".git repository" },
        sublabel: { vi: "lịch sử commit", en: "commit history" },
      },
    ],
    edges: [
      { id: "e-add", from: "wd", to: "index", label: "git add", tone: "amber" },
      { id: "e-commit", from: "index", to: "repo", label: "git commit", tone: "green" },
      {
        id: "e-restore",
        from: "repo",
        to: "wd",
        curve: -150,
        dashed: true,
        hidden: true,
        tone: "violet",
        label: "git restore",
      },
    ],
  },
  legend: [
    { tone: "amber", label: { vi: "Chuẩn bị (stage)", en: "Stage" } },
    { tone: "green", label: { vi: "Ghi lại (commit)", en: "Commit" } },
    { tone: "violet", label: { vi: "Lấy lại", en: "Restore" } },
  ],
  steps: [
    {
      title: { vi: "Ba nơi, một hướng đi", en: "Three places, one direction" },
      body: {
        vi: "Mọi thay đổi đi theo một chiều: **sửa** trong thư mục làm việc, **chọn** vào staging, rồi **ghi** vào kho. Hai bước sau là hai lệnh khác nhau, và đó là chủ ý.",
        en: "Every change flows one way: **edit** in the working directory, **pick** it into staging, then **record** it in the repository. The last two are separate commands on purpose.",
      },
      state: { highlight: ["wd", "index", "repo"] },
    },
    {
      title: { vi: "Bạn sửa một file", en: "You edit a file" },
      body: {
        vi: "Bạn sửa `hello.txt`. Git nhận ra file đã **thay đổi (modified)**, nhưng chưa ghi lại gì. Nếu bây giờ máy hỏng, thay đổi này chỉ có trên đĩa của bạn.",
        en: "You edit `hello.txt`. Git notices the file is **modified**, but nothing is recorded yet. If your laptop died now, this change would exist only on your disk.",
      },
      state: {
        highlight: ["wd"],
        focus: true,
        notes: [{ at: "wd", text: { vi: "hello.txt · đã sửa", en: "hello.txt · modified" }, tone: "blue" }],
      },
    },
    {
      title: { vi: "git add: chọn thay đổi", en: "git add: pick the change" },
      body: {
        vi: "`git add hello.txt` chép phiên bản hiện tại của file vào **staging**. Staging giống giỏ hàng: bạn gom đúng những thay đổi muốn đưa vào commit kế tiếp.",
        en: "`git add hello.txt` copies the file's current version into **staging**. Staging is like a shopping cart: you gather exactly the changes you want in the next commit.",
      },
      detail: {
        vi: "Vì staging chứa *bản sao*, nếu bạn sửa tiếp `hello.txt` sau khi add, commit vẫn dùng bản đã add. Muốn lấy bản mới nhất thì `git add` lại.",
        en: "Because staging holds a *copy*, editing `hello.txt` again after adding does not change what gets committed. Run `git add` again to include the newest version.",
      },
      state: {
        highlight: ["e-add", "index"],
        flows: [{ from: "wd", to: "index", label: "hello.txt", tone: "amber" }],
      },
    },
    {
      title: { vi: "git commit: chụp ảnh", en: "git commit: take the snapshot" },
      body: {
        vi: "`git commit -m \"Chào thế giới\"` biến nội dung staging thành một **commit**: ảnh chụp kèm tác giả, thời gian, lời nhắn và một mã định danh duy nhất.",
        en: "`git commit -m \"Hello world\"` turns what is in staging into a **commit**: a snapshot plus author, time, message and a unique id.",
      },
      facts: [
        [{ vi: "Mã commit", en: "Commit id" }, "a1b2c3d…"],
        [{ vi: "Chứa", en: "Contains" }, { vi: "ảnh chụp + commit cha", en: "snapshot + parent commit" }],
      ],
      state: {
        highlight: ["e-commit", "repo"],
        flows: [{ from: "index", to: "repo", label: "snapshot", tone: "green" }],
        notes: [{ at: "repo", text: "commit a1b2c3d", tone: "green" }],
      },
      quiz: {
        question: {
          vi: "Bạn sửa file rồi chạy `git commit` mà quên `git add`. Chuyện gì xảy ra?",
          en: "You edit a file and run `git commit` without `git add`. What happens?",
        },
        options: [
          { vi: "Thay đổi được commit bình thường", en: "The change is committed normally" },
          { vi: "Không có gì được commit vì staging trống", en: "Nothing is committed because staging is empty" },
          { vi: "Git tự xoá thay đổi", en: "Git deletes the change" },
        ],
        answer: 1,
        explain: {
          vi: "Commit chỉ lấy những gì có trong staging.",
          en: "A commit only takes what is in staging.",
        },
      },
    },
    {
      title: { vi: "Đi ngược lại", en: "Going back" },
      body: {
        vi: "Vì mỗi commit là một ảnh chụp, bạn luôn lấy lại được: `git restore hello.txt` chép phiên bản trong kho đè lên file đang sửa.",
        en: "Since every commit is a snapshot, you can always go back: `git restore hello.txt` copies the repository's version over the file you are editing.",
      },
      state: {
        show: ["e-restore"],
        highlight: ["e-restore", "wd"],
        flows: [{ from: "repo", to: "wd", label: "hello.txt", tone: "violet" }],
      },
    },
    {
      title: { vi: "Trong terminal", en: "In the terminal" },
      body: {
        vi: "Toàn bộ vòng vừa xem chỉ là bốn lệnh. `git status` cho biết mỗi file đang ở vùng nào.",
        en: "The whole loop you just watched is four commands. `git status` tells you which area every file is in.",
      },
      visual: {
        type: "code",
        title: "terminal",
        language: "bash",
        code: `$ git status
modified:   hello.txt

$ git add hello.txt
$ git status
Changes to be committed:
  modified:   hello.txt

$ git commit -m "Hello world"
[main a1b2c3d] Hello world
 1 file changed, 1 insertion(+)`,
      },
      state: { lines: "4-7,9-11" },
    },
  ],
  outro: {
    title: { vi: "Đã nắm được vòng cơ bản", en: "You have the basic loop" },
    body: {
      vi: "Sửa → `git add` → `git commit`. Staging cho bạn quyết định chính xác cái gì vào lịch sử, còn commit là ảnh chụp không đổi mà bạn luôn quay lại được.",
      en: "Edit → `git add` → `git commit`. Staging lets you decide exactly what enters history, and a commit is an unchanging snapshot you can always return to.",
    },
    facts: [
      [{ vi: "Xem trạng thái", en: "See state" }, "`git status`"],
      [{ vi: "Xem lịch sử", en: "See history" }, "`git log --oneline`"],
    ],
  },
  sources: [{ title: "Pro Git, ch. 2: Git Basics", url: "https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository" }],
});
