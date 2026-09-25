/**
 * 純 DOM 的成功／錯誤提示。
 * 為什麼不用 React state：後台操作後會呼叫 router.refresh() 讓畫面重新掛載，
 * 任何放在 React state 裡的提示都會被清掉，管理員會以為「按了沒反應」。
 * 直接掛在 document.body 上就不受重新掛載影響。
 */
export function domToast(type: 'ok' | 'err', text: string, ms = 3200) {
  if (typeof document === 'undefined') return;

  const el = document.createElement('div');
  el.textContent = text;
  el.setAttribute('data-msw-toast', '1');
  el.style.position = 'fixed';
  el.style.left = '50%';
  el.style.top = '96px';
  el.style.transform = 'translateX(-50%)';
  el.style.zIndex = '9999';
  el.style.maxWidth = '90vw';
  el.style.padding = '14px 26px';
  el.style.borderRadius = '14px';
  el.style.fontSize = '14px';
  el.style.fontWeight = '600';
  el.style.pointerEvents = 'none';
  el.style.boxShadow = '0 20px 60px rgba(0,0,0,.55)';
  el.style.backdropFilter = 'blur(8px)';
  if (type === 'ok') {
    el.style.background = 'rgba(16,185,129,.2)';
    el.style.color = '#6ee7b7';
    el.style.border = '1px solid rgba(16,185,129,.45)';
  } else {
    el.style.background = 'rgba(227,0,27,.2)';
    el.style.color = '#ff9b9b';
    el.style.border = '1px solid rgba(227,0,27,.45)';
  }

  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
