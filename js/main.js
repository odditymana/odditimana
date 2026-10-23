// ハンバーガーメニュー（スマホ）
const navToggle = document.querySelector('.nav-toggle');
const globalNav = document.querySelector('.global-nav');

if (navToggle && globalNav) {
  const setMenu = (isOpen) => {
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
    globalNav.classList.toggle('is-open', isOpen);
    document.body.classList.toggle('is-menu-open', isOpen);
  };

  navToggle.addEventListener('click', () => {
    setMenu(navToggle.getAttribute('aria-expanded') !== 'true');
  });

  // メニュー内のリンクを押したら閉じる
  globalNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMenu(false));
  });

  // Escキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      navToggle.focus();
    }
  });

  // PC幅に戻ったら状態をリセット
  window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => {
    if (e.matches) setMenu(false);
  });
}
