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

// 画像の拡大表示（ライトボックス）。トップのフライヤーと作品詳細の画面キャプチャで共通。
// data-large を持つボタンが対象で、data-lightbox="tall" なら縦スクロールで全体を見せる
const lightbox = document.querySelector('.lightbox');

if (lightbox) {
  const lightboxImage = lightbox.querySelector('.lightbox__image');
  const closeButton = lightbox.querySelector('.lightbox__close');
  let opener = null;

  const openLightbox = (button) => {
    const thumb = button.querySelector('img');
    const largeSrc = button.dataset.large;

    opener = button;
    // 読み込み済みの一覧用画像を先に出し、拡大用は開いたときに読み込んで差し替える
    lightboxImage.src = thumb.currentSrc || thumb.src;
    lightboxImage.alt = thumb.alt;
    lightbox.classList.toggle('lightbox--tall', button.dataset.lightbox === 'tall');
    lightbox.showModal();
    lightbox.scrollTop = 0;

    const large = new Image();
    large.onload = () => {
      if (lightbox.open && opener === button) lightboxImage.src = largeSrc;
    };
    large.src = largeSrc;
  };

  document.querySelectorAll('button[data-large]').forEach((button) => {
    button.addEventListener('click', () => openLightbox(button));
  });

  closeButton.addEventListener('click', () => lightbox.close());

  // 画像以外（背景）をクリックしたら閉じる
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) lightbox.close();
  });

  // Escキーでの close も含め、閉じたら元のボタンにフォーカスを戻す
  lightbox.addEventListener('close', () => {
    lightboxImage.removeAttribute('src');
    if (opener) opener.focus();
    opener = null;
  });
}
