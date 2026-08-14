import type { Lang, Translate } from "../lib/i18n";
import type { Theme } from "../lib/storage";

interface Props {
  theme: Theme;
  onCycleTheme: () => void;
  lang: Lang;
  onToggleLang: () => void;
  homeHref: string;
  t: Translate;
}

export function Header({ theme, onCycleTheme, lang, onToggleLang, homeHref, t }: Props) {
  const themeLabel = t(theme === "dark" ? "theme.dark" : "theme.light");

  return (
    <header className="header">
      <div className="header__inner">
        <a className="brand" href={homeHref}>
          <span className="brand__mark" aria-hidden="true">
            🍛
          </span>
          <span className="brand__text">
            <span className="brand__title">{t("brand.title")}</span>
            <span className="brand__sub">{t("brand.sub")}</span>
          </span>
        </a>

        <button
          type="button"
          className="langswitch"
          onClick={onToggleLang}
          aria-label={t("lang.switch")}
          title={t("lang.switch")}
        >
          <span className={lang === "ko" ? "langswitch__on" : "langswitch__off"}>한</span>
          <span className={lang === "en" ? "langswitch__on" : "langswitch__off"}>EN</span>
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onCycleTheme}
          title={t("theme.toggle", { mode: themeLabel })}
          aria-label={t("theme.toggle", { mode: themeLabel })}
        >
          <span aria-hidden="true">{theme === "dark" ? "🌙" : "☀️"}</span>
        </button>
      </div>
    </header>
  );
}
