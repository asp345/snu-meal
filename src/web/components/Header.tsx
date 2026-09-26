interface HeaderProps {
  statusText: string;
}

export function Header(props: HeaderProps) {
  return (
    <header class="site-header">
      <div class="header-inner">
        <div class="brand-block">
          <p class="brand-kicker">SEOUL NATIONAL UNIVERSITY</p>
          <h1>서울대 학식 정보</h1>
        </div>
        <div class="data-note">
          <p class="data-status">{props.statusText}</p>
        </div>
      </div>
    </header>
  );
}
