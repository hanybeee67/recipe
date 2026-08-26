import { useState } from "react";
import type { Manager } from "../lib/auth";
import { buildExport, downloadExport, saveStandalone, type EditStore } from "../lib/edits";
import type { Translate } from "../lib/i18n";

interface Props {
  /** 로그아웃 상태에서도 이미 만든 수정분은 저장할 수 있어야 한다 */
  manager: Manager | null;
  /** 이 파일이 들고 있는 발행분 + 이 기기의 수정분 — 저장에 담기는 전체 내용 */
  published: EditStore;
  count: number;
  onRevertAll: () => void;
  t: Translate;
}

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; file: string } | { kind: "error"; message: string };

/**
 * 수정분이 있을 때 화면 아래에 붙는 막대.
 *
 * 주 버튼은 **「수정본 저장」** — 고친 내용이 박힌 새 앱 파일을 만든다. 받은 사람은
 * 더블클릭만 하면 되므로, 명령어를 모르는 사람도 여기서 끝난다.
 * JSON 내보내기는 저장소에 정식 반영할 때만 쓰는 보조 경로다.
 */
export function EditBar({ manager, published, count, onRevertAll, t }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  if (count === 0) return null;

  async function saveApp() {
    setState({ kind: "busy" });
    try {
      const file = await saveStandalone(published);
      setState({ kind: "done", file });
      setTimeout(() => setState({ kind: "idle" }), 12_000);
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  function exportJson() {
    const by = manager ? `${manager.name} (${manager.id})` : "(로그아웃 상태)";
    const file = downloadExport(buildExport(published, by));
    setState({ kind: "done", file });
    setTimeout(() => setState({ kind: "idle" }), 12_000);
  }

  const status =
    state.kind === "done"
      ? t("editbar.saved", { file: state.file })
      : state.kind === "error"
        ? state.message
        : t("editbar.local");

  return (
    <div className="editbar no-print" role="status">
      <div className="editbar__inner">
        <span className="editbar__count">{t("editbar.pending", { n: count })}</span>
        <span className={state.kind === "error" ? "editbar__where editbar__where--bad" : "editbar__where"}>
          {status}
        </span>
        <div className="editbar__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onRevertAll}>
            {t("editbar.revertAll")}
          </button>
          <button type="button" className="btn btn--sm" onClick={exportJson}>
            {t("editbar.exportJson")}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={saveApp}
            disabled={state.kind === "busy"}
          >
            💾 {state.kind === "busy" ? t("editbar.saving") : t("editbar.saveApp")}
          </button>
        </div>
      </div>
    </div>
  );
}
