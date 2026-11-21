import { Images, Palette, Sparkles } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI 擬真預覽圖",
    description:
      "上傳房間照片後，產出風格化的擬真預覽圖（平面影像），讓你先比較 Before／After 再決定方向。",
  },
  {
    icon: Images,
    title: "動線與採光分析",
    description:
      "搭配文字分析報告，整理動線建議、採光層次與風格色盤，方便後續與設計師溝通。",
  },
  {
    icon: Palette,
    title: "專屬風格客製化",
    description:
      "依生活習慣、空間條件與個人喜好量身提案，打造獨一無二的溫柔質感日常。",
  },
];

export default function Features() {
  return (
    <section id="services" className="section-pad">
      <div className="section-shell">
        <div className="max-w-2xl">
          <p className="eyebrow">服務項目</p>
          <h2 className="headline mt-3 text-[clamp(1.85rem,4vw,2.75rem)]">
            三個核心，讓軟裝提案更精準
          </h2>
          <p className="mt-4 text-base leading-7 text-ink-muted md:text-lg">
            從靈感提案到 AI 擬真預覽圖，我們陪你把理想空間具體看見。
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="group border-t border-line pt-6"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-transform duration-300 group-hover:-translate-y-1">
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <h3 className="font-display text-xl font-semibold tracking-tight text-ink">
                  {feature.title}
                </h3>
                <p className="mt-3 text-[0.98rem] leading-7 text-ink-muted">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
