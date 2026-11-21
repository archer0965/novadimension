import Link from "next/link";
import { LogIn, Sparkles, Timer } from "lucide-react";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import { getNovaOsLoginUrl } from "@/lib/novaos-hub";

export default function Hero() {
  return (
    <section id="hero" className="section-pad pt-28 md:pt-32">
      <div className="section-shell grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div className="reveal">
          <p className="eyebrow">
            <Timer size={14} aria-hidden />
            30 秒 AI 軟裝改造
          </p>
          <h1 className="headline mt-4 text-[clamp(2rem,5.2vw,3.35rem)] text-ink">
            不用大興土木，用 AI 擬真預覽打造你的理想生活空間
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-ink-muted md:text-lg">
            上傳房間照片，約 30 秒產出擬真預覽圖，並附動線規劃與採光分析。靈感設計 ·
            擬真預覽圖 · IG 諮詢。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href={getNovaOsLoginUrl()} className="btn btn-primary">
              <LogIn size={16} aria-hidden />
              登入贈 1 次 Credit
            </a>
            <Link href="#studio" className="btn btn-secondary">
              <Sparkles size={16} aria-hidden />
              先看 AI 工作室
            </Link>
          </div>
          <p className="mt-5 text-sm text-ink-muted">
            拓維空間 · 附屬於拓新雲端 · 登入贈 1 次 Credit（訪客無免費次數）
          </p>
        </div>

        <div className="reveal reveal-delay-1">
          <BeforeAfterSlider
            beforeSrc="/gallery-1.jpg"
            afterSrc="/case-living.jpg"
            beforeLabel="改造前"
            afterLabel="AI 擬真"
          />
          <p className="mt-3 text-center text-xs tracking-wide text-ink-muted">
            拖曳滑塊比較 Before / After
          </p>
        </div>
      </div>
    </section>
  );
}
