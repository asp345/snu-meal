interface StatePanelProps {
  variant: "loading" | "error" | "empty";
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function StatePanel(props: StatePanelProps) {
  if (props.variant === "loading") {
    return (
      <section class="state-panel loading-state" aria-live="polite">
        <span class="loading-mark" />
        <h2 class="state-title">오늘의 식단을 불러오는 중입니다</h2>
        <p class="state-copy">잠시만 기다려 주세요.</p>
      </section>
    );
  }

  if (props.variant === "error") {
    return (
      <section class="state-panel error-state" role="alert">
        <h2 class="state-title">메뉴를 가져오지 못했습니다</h2>
        <p class="state-copy">{props.description ?? "알 수 없는 오류가 발생했습니다."}</p>
        {props.onRetry && (
          <button type="button" class="retry-button" onClick={props.onRetry}>
            다시 시도
          </button>
        )}
      </section>
    );
  }

  return (
    <section class="state-panel empty-state">
      <h2 class="state-title">{props.title ?? "등록된 메뉴가 없습니다"}</h2>
      <p class="state-copy">{props.description ?? ""}</p>
    </section>
  );
}
