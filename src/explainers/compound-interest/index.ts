import { defineExplainer, defineLesson } from "../../kit/define";

/**
 * A non-technical example: shows the chart, cards and table visuals and
 * scene changes. 100 million at 8% a year; simple = 100 + 8n,
 * compound = 100 × 1.08ⁿ (rounded).
 */
const powerOfCompounding = defineLesson({
  id: "power-of-compounding",
  icon: "📈",
  level: "beginner",
  minutes: 3,
  title: { vi: "Sức mạnh của lãi kép", en: "The power of compounding" },
  summary: {
    vi: "Vì sao cùng một lãi suất, lãi kép bỏ xa lãi đơn sau vài chục năm.",
    en: "Why, at the same rate, compound interest leaves simple interest far behind after a few decades.",
  },
  intro: {
    body: {
      vi: "Bạn gửi **100 triệu** với lãi suất **8%/năm** và không rút ra. Với lãi đơn, mỗi năm bạn nhận đúng 8 triệu. Với lãi kép, tiền lãi cũng được tính lãi. Khác biệt nhỏ ấy lớn đến đâu?",
      en: "You deposit **100 million** at **8% a year** and never withdraw. With simple interest you earn exactly 8 million every year. With compound interest the interest itself earns interest. How big can that small difference get?",
    },
    facts: [
      [{ vi: "Vốn gốc", en: "Principal" }, { vi: "100 triệu", en: "100 million" }],
      [{ vi: "Lãi suất", en: "Rate" }, { vi: "8%/năm", en: "8% / year" }],
      [{ vi: "Công thức kép", en: "Compound formula" }, "P × (1 + r)ⁿ"],
    ],
  },
  stage: {
    type: "chart",
    title: { vi: "Số dư (triệu)", en: "Balance (million)" },
    max: 1010,
    bars: [
      { id: "principal", label: { vi: "Vốn gốc", en: "Principal" }, value: 100, tone: "slate" },
      { id: "simple", label: { vi: "Lãi đơn", en: "Simple" }, value: 100, tone: "blue" },
      { id: "compound", label: { vi: "Lãi kép", en: "Compound" }, value: 100, tone: "green" },
    ],
  },
  steps: [
    {
      title: { vi: "Năm 0", en: "Year 0" },
      body: {
        vi: "Ba cột đều bằng nhau: 100 triệu. Hai cách tính lãi chỉ bắt đầu khác nhau từ năm thứ hai.",
        en: "All three bars are equal: 100 million. The two methods only start to differ in the second year.",
      },
      state: { highlight: ["principal"] },
    },
    {
      title: { vi: "Sau 10 năm", en: "After 10 years" },
      body: {
        vi: "Lãi đơn: 100 + 10 × 8 = **180**. Lãi kép: 100 × 1,08¹⁰ ≈ **216**. Chênh 36 triệu, chưa có gì quá ấn tượng.",
        en: "Simple: 100 + 10 × 8 = **180**. Compound: 100 × 1.08¹⁰ ≈ **216**. A 36 million gap, nothing dramatic yet.",
      },
      state: { values: { simple: 180, compound: 216 }, highlight: ["simple", "compound"] },
    },
    {
      title: { vi: "Sau 20 năm", en: "After 20 years" },
      body: {
        vi: "Lãi đơn: **260**. Lãi kép: **466**. Riêng phần lãi kép đã gần gấp đôi lãi đơn, vì mỗi năm nó tính trên một con số lớn hơn.",
        en: "Simple: **260**. Compound: **466**. The compound gain is now almost double, because every year it grows from a bigger base.",
      },
      state: { values: { simple: 260, compound: 466 }, highlight: ["compound"] },
    },
    {
      title: { vi: "Sau 30 năm", en: "After 30 years" },
      body: {
        vi: "Lãi đơn: **340**. Lãi kép: **≈ 1.006**, gấp **10 lần** vốn ban đầu. Một nửa số tiền ấy đến chỉ trong 9 năm cuối.",
        en: "Simple: **340**. Compound: **≈ 1,006**, **10×** the starting amount. Half of that money arrives in the last 9 years alone.",
      },
      state: { values: { simple: 340, compound: 1006 }, highlight: ["compound"], focus: true },
      quiz: {
        question: { vi: "Điều gì làm lãi kép tăng nhanh dần?", en: "What makes compound growth speed up?" },
        options: [
          { vi: "Lãi suất tăng mỗi năm", en: "The rate rises every year" },
          { vi: "Lãi được tính trên cả tiền lãi cũ", en: "Interest is earned on past interest" },
          { vi: "Ngân hàng thưởng thêm", en: "The bank adds a bonus" },
        ],
        answer: 1,
      },
    },
    {
      title: { vi: "Ba đòn bẩy", en: "Three levers" },
      body: {
        vi: "Kết quả phụ thuộc vào ba thứ bạn điều chỉnh được. Trong đó **thời gian** là đòn bẩy mạnh nhất, vì nó nằm ở số mũ.",
        en: "The outcome depends on three things you control. **Time** is the strongest lever, because it sits in the exponent.",
      },
      visual: {
        type: "cards",
        columns: 3,
        items: [
          { id: "rate", icon: "％", tone: "blue", title: { vi: "Lãi suất", en: "Rate" }, body: { vi: "8% thay vì 6% làm kết quả 30 năm gần gấp **1,7 lần**.", en: "8% instead of 6% makes the 30-year result almost **1.7×** bigger." } },
          { id: "time", icon: "⏳", tone: "green", title: { vi: "Thời gian", en: "Time" }, body: { vi: "Bắt đầu sớm 10 năm thường quan trọng hơn gửi nhiều hơn.", en: "Starting 10 years earlier usually matters more than depositing more." } },
          { id: "keep", icon: "🔒", tone: "amber", title: { vi: "Không rút", en: "Don't withdraw" }, body: { vi: "Rút lãi ra là quay về lãi đơn.", en: "Taking the interest out turns it back into simple interest." } },
        ],
      },
      state: { highlight: ["time"] },
    },
    {
      title: { vi: "Quy tắc 72", en: "The rule of 72" },
      body: {
        vi: "Mẹo nhẩm: lấy **72 chia cho lãi suất** sẽ ra số năm để tiền tăng gấp đôi. Ở 8%, là khoảng 9 năm.",
        en: "Mental shortcut: **72 divided by the rate** gives the years to double your money. At 8% that is about 9 years.",
      },
      visual: {
        type: "table",
        columns: [
          { vi: "Lãi suất", en: "Rate" },
          { vi: "72 ÷ lãi suất", en: "72 ÷ rate" },
          { vi: "Thực tế", en: "Exact" },
        ],
        rows: [
          ["4%", { vi: "18 năm", en: "18 years" }, "17.7"],
          ["6%", { vi: "12 năm", en: "12 years" }, "11.9"],
          ["8%", { vi: "9 năm", en: "9 years" }, "9.0"],
          ["12%", { vi: "6 năm", en: "6 years" }, "6.1"],
        ],
      },
      state: { rows: [2] },
    },
  ],
  outro: {
    title: { vi: "Thời gian là đồng minh", en: "Time is your ally" },
    body: {
      vi: "Lãi kép không phải phép màu: chỉ là tăng trưởng theo tỉ lệ được lặp lại. Nhưng lặp đủ lâu, nó biến 100 thành hơn 1.000.",
      en: "Compounding is not magic: it is proportional growth, repeated. Repeat it long enough and it turns 100 into more than 1,000.",
    },
  },
});

export default defineExplainer({
  id: "compound-interest",
  icon: "💰",
  accent: "amber",
  status: "beta",
  category: { vi: "Tài chính", en: "Finance" },
  tags: ["finance", "math"],
  locales: ["en", "vi"],
  title: { vi: "Lãi kép", en: "Compound interest" },
  tagline: { vi: "Vì sao bắt đầu sớm lại quan trọng", en: "Why starting early matters" },
  description: {
    vi: "Ví dụ ngoài lĩnh vực kỹ thuật: biểu đồ, thẻ khái niệm và bảng, chỉ với một bài học ngắn.",
    en: "A non-technical example: charts, concept cards and a table, in one short lesson.",
  },
  lessons: [powerOfCompounding],
});
