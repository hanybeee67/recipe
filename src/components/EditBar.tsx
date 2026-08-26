import { useState } from "react";
import type { Manager } from "../lib/auth";
import { buildExport, downloadExport, type EditStore } from "../lib/edits";
import type { Translate } from "../lib/i18n";

interface Props {
  /** 로그아웃 상태에서도 이미 만든 수정분은 내보낼 수 있어야 한다 */
  manager: Manager | null;
  edits: EditStore;
  count: number;
  onRevertAll: () => void;
  t: Translate;
}

/**
 * 수정 모드일 때 화면 아래에 붙는 막대.
 * 이 기기에만 저장돼 있다는 사실과, 전원에게 반영하려면 파일을 내보내야 한다는
 * 것을 계속 눈에 보이게 한다.
 */
export function EditBar({ manager, edits, count, onRevertAll, t }: Props) {
  const [saved, setSaved] = useState<string | null>(null);

  if (count === 0) return null;

  function exportNow() {
    const by = manager ? `${manager.name} (${manager.id})` : "(로그아웃 상태)";
    const name = downloadExport(buildExport(edits, by));
    setSaved(name);
    setTimeout(() => setSaved(null), 8000);
  }

  return (
    <div className="editbar no-print" role="status">
      <div className="editbar__inner">
        <span className="editbar__count">{t("editbar.pending", { n: count })}</span>
        <span className="editbar__where">{saved ? t("editbar.saved", { file: saved }) : t("editbar.local")}</span>
        <div className="editbar__actions">
          <button type="button" className="btn btn--sm" onClick={onRevertAll}>
            {t("editbar.revertAll")}
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={exportNow}>
            ⬇ {t("editbar.export")}
          </button>
        </div>
      </div>
    </div>
  );
}
