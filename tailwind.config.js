// Конфиг Tailwind для сборки css/tailwind.css (scripts/build-css.sh).
// Раньше он жил в index.html, а CSS собирал в браузере скрипт
// cdn.tailwindcss.com. Стоило скрипту не загрузиться (блокировщик, прокси,
// недоступный CDN) — у посетителя страница превращалась в голый HTML:
// из 340 правил на месте оставались 52 из style.css. Теперь CSS готовый
// и отдаётся самим GitHub Pages.
/** @type {import('tailwindcss').Config} */
module.exports = {
  // js/ — тоже: main.js переключает hidden/flex и cursor-grab(bing).
  content: ["./index.html", "./js/**/*.js"],
  theme: {
    extend: {
      colors: {
        // rgb(var(--x) / <alpha-value>) — паттерн Tailwind для CSS-переменных:
        // переменные в style.css хранят "R G B" каналы, поэтому модификаторы
        // прозрачности вроде bg-coral/70 или border-line/60 считаются правильно.
        bg: "rgb(var(--bg) / <alpha-value>)",
        "bg-alt": "rgb(var(--bg-alt) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-soft": "rgb(var(--ink-soft) / <alpha-value>)",
        "ink-faint": "rgb(var(--ink-faint) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        violet: "rgb(var(--violet) / <alpha-value>)",
        "violet-soft": "rgb(var(--violet-soft) / <alpha-value>)",
        mint: "rgb(var(--mint) / <alpha-value>)",
        "mint-soft": "rgb(var(--mint-soft) / <alpha-value>)",
        coral: "rgb(var(--coral) / <alpha-value>)",
        "coral-soft": "rgb(var(--coral-soft) / <alpha-value>)",
        amber: "rgb(var(--amber) / <alpha-value>)",
        "amber-soft": "rgb(var(--amber-soft) / <alpha-value>)"
      },
      fontFamily: {
        display: ['"Fraunces"', "ui-serif", "Georgia", "serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        soft: "0 24px 60px -24px rgba(30,34,51,0.18)",
        card: "0 12px 32px -16px rgba(30,34,51,0.14)",
        lift: "0 30px 70px -20px rgba(108,99,242,0.35)"
      },
      borderRadius: { "4xl": "1.75rem", "5xl": "2.25rem" }
    }
}
};
