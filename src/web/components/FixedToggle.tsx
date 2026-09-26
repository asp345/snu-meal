interface FixedToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function FixedToggle(props: FixedToggleProps) {
  return (
    <label class="fixed-control">
      <span class="toggle-copy">
        <strong>상시 메뉴</strong>
      </span>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
      <span class="toggle-track" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}
