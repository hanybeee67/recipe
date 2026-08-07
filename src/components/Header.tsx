import type { Theme } from "../lib/storage";

const THEME_ICON: Record<Theme, string> = { system: "🖥️", light: "☀️", dark: "🌙" };
const THEME_LABEL: Record<Theme, string> = {
  system: "시스템 설정 따름",
  light: "라이트 모드",
  dark: "다크 모드",
};

interface Props {
  theme: Theme;
  onCycleTheme: () => void;
  homeHref: string;
}

export function Header({ theme, onCycleTheme, homeHref }: Props) {
  return (
    <header className="header">
      <div className="header__inner">
        <a className="brand" href={homeHref}>
          <span className="brand__mark" aria-hidden="true">
            🍛
          </span>
          <span className="brand__text">
            <span className="brand__title">에베레스트 레시피북</span>
            <span className="brand__sub">Everest Restaurant Group</span>
          </span>
        </a>

        <button
          type="button"
          className="icon-btn"
          onClick={onCycleTheme}
          title={`테마: ${THEME_LABEL[theme]} (클릭하여 전환)`}
          aria-label={`테마 전환. 현재 ${THEME_LABEL[theme]}`}
        >
          <span aria-hidden="true">{THEME_ICON[theme]}</span>
        </button>
      </div>
    </header>
  );
}
