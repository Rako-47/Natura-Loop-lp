/* Natura Loop DAILY BASE LP（課題用・架空ストア）
 * UI・金額計算・計測・購入フォーム送信（GAS）
 */
(function () {
  'use strict';

  // iOS Safari でボタン・リンクの :active（押した感）を効かせる
  document.addEventListener('touchstart', function () {}, { passive: true });

  // ---- スクロールで現れるアニメーション（下からフェードアップ）----
  // 対象は HTML の data-reveal 属性。同時に画面に入った要素は少しずつ遅らせて順番に表示する。
  (function () {
    var els = document.querySelectorAll('[data-reveal]');
    var root = document.documentElement;
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('is-in'); });
      root.classList.add('reveal-ok');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      var i = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.style.transitionDelay = Math.min(i, 6) * 90 + 'ms';
        en.target.classList.add('is-in');
        io.unobserve(en.target);
        i += 1;
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (e) { io.observe(e); });
    root.classList.add('reveal-ok'); // 動いたら、CSS側の「3.5秒後に全部表示する」保険を止める
  })();

  var C = window.CONFIG || {};
  var PRICE = 3240, DISC = 324, SHIP = 550, COD = 220, CODE = 'BASE10';
  var PREFS = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
  var MSG = {
    INVALID_INPUT: '入力内容をご確認ください。',
    COUPON_INVALID: 'コードが正しくありません。BASE10をご確認ください。',
    COUPON_NOT_STARTED: 'このキャンペーンは2026年11月1日から開始します。',
    COUPON_EXPIRED: 'このキャンペーンは終了しました。',
    COUPON_NOT_ELIGIBLE: 'このコードは初めてご購入の方が対象です。コードを外して通常価格で購入できます。',
    BUSY: '混み合っています。少し時間をおいて、もう一度お試しください。',
    SERVER_ERROR: '送信できませんでした。通信状況をご確認のうえ、もう一度お試しください。',
    NETWORK: '送信できませんでした。通信状況をご確認のうえ、もう一度お試しください。（入力内容は保持されています）',
    NO_GAS: '送信先（GAS）が未設定です。js/config.js の GAS_URL を設定してください。'
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function yen(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '円'; }
  function toHalf(s) { return String(s || '').replace(/[０-９Ａ-Ｚａ-ｚ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* ---------- 計測（T12） ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (/^G-[A-Z0-9]+$/i.test(C.GA_ID || '')) {
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(C.GA_ID);
    document.head.appendChild(s);
    gtag('js', new Date()); gtag('config', C.GA_ID);
  }
  function track(name, params) {
    var p = params || {};
    window.dataLayer.push({ event: name, params: p });
    if (/^G-/i.test(C.GA_ID || '')) { gtag('event', name, p); }
  }

  /* ---------- 要素 ---------- */
  var dlg = $('#order'), form = $('#orderForm'), legal = $('#legal');
  var state = { coupon: '', removed: false, view: 'input', sending: false };
  var params = new URLSearchParams(location.search);
  var initialCoupon = (params.get('coupon') || CODE).toUpperCase();

  /* 都道府県 */
  var prefSel = $('#f-pref');
  PREFS.forEach(function (p) { var o = document.createElement('option'); o.value = p; o.textContent = p; prefSel.appendChild(o); });

  function val(name) { var e = form.elements.namedItem(name); return e ? (e.value || '') : ''; }
  function payment() { return val('payment') === 'cod' ? 'cod' : 'card'; }

  /* ---------- 金額 ---------- */
  function calc() {
    var d = state.coupon ? DISC : 0, fee = payment() === 'cod' ? COD : 0;
    return { d: d, fee: fee, total: PRICE - d + SHIP + fee };
  }
  function renderSum() {
    var c = calc(), box = $('#sumBox');
    box.textContent = '';
    function row(a, b) { var r = el('div', 'r'); r.appendChild(el('span', '', a)); r.appendChild(el('span', '', b)); box.appendChild(r); }
    row('商品代金', yen(PRICE));
    if (c.d) row('キャンペーン割引（10%OFF）', '−' + yen(c.d));
    row('送料（全国一律）', yen(SHIP));
    if (c.fee) row('コンビニ後払い手数料', yen(c.fee));
    var t = el('div', 'tot'); t.appendChild(el('span', '', '合計（税込）')); t.appendChild(el('b', '', yen(c.total))); box.appendChild(t);
  }

  /* ---------- クーポン（T01） ---------- */
  var cpnInput = $('#coupon'), cpnSt = $('#cpnStatus'), cpnRemove = $('#removeCpn');
  function setCpn(msg, kind) { cpnSt.textContent = msg; cpnSt.className = 'cpn-st' + (kind ? ' ' + kind : ''); }
  function applyCoupon(raw, auto) {
    var code = toHalf(raw).trim().toUpperCase();
    cpnInput.value = code;
    if (!code) { state.coupon = ''; setCpn('コードを入力してください。', 'ng'); cpnRemove.hidden = true; renderSum(); return false; }
    if (code !== CODE) { state.coupon = ''; setCpn(MSG.COUPON_INVALID, 'ng'); cpnRemove.hidden = true; renderSum(); return false; }
    state.coupon = CODE; state.removed = false;
    setCpn('10%OFFが適用されました', 'ok'); cpnRemove.hidden = false; renderSum();
    track('coupon_apply', { coupon: CODE, auto: !!auto });
    return true;
  }
  function removeCoupon() {
    state.coupon = ''; state.removed = true; cpnInput.value = '';
    setCpn('', ''); cpnRemove.hidden = true; renderSum();
  }
  $('#applyBtn').addEventListener('click', function () { applyCoupon(cpnInput.value); });
  cpnInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(cpnInput.value); } });
  cpnRemove.addEventListener('click', removeCoupon);
  $$('input[name=payment]').forEach(function (r) { r.addEventListener('change', renderSum); });

  /* ---------- ダイアログ（購入） ---------- */
  var viewOrder = ['input', 'confirm', 'done'];
  function showView(v) {
    state.view = v;
    $$('[data-view]').forEach(function (n) { n.hidden = n.getAttribute('data-view') !== v; });
    $$('[data-bar]').forEach(function (n) { n.hidden = n.getAttribute('data-bar') !== v; });
    $$('.od-steps li').forEach(function (li) { li.classList.toggle('on', li.getAttribute('data-s') === v); });
    $('#sumBox').hidden = v === 'done';
    $('#formErr').hidden = true;
    var body = $('[data-view="' + v + '"]'); if (body) body.scrollTop = 0;
    var t = $('#odTitle'); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true });
  }
  function openOrder() {
    if (dlg.open) return;
    if (state.view === 'done') { form.reset(); clearErrors(); showView('input'); }
    if (!state.coupon && !state.removed) applyCoupon(initialCoupon, true);
    renderSum();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    history.pushState({ order: 1 }, '', '#order');
    showView(state.view === 'done' ? 'input' : state.view);
    track('begin_checkout', { value: calc().total, currency: 'JPY' });
    syncSticky();
  }
  function closeDlg(d) { if (d.open) { if (d.close) d.close(); else d.removeAttribute('open'); } }
  dlg.addEventListener('close', function () {
    if (history.state && history.state.order) history.back();
    syncSticky();
  });
  window.addEventListener('popstate', function () { if (dlg.open) closeDlg(dlg); });
  $('#odClose').addEventListener('click', function () { closeDlg(dlg); });
  $('#doneClose').addEventListener('click', function () { closeDlg(dlg); });

  $$('[data-open-order]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      track('cta_click_buy', { position: a.getAttribute('data-cta-pos') || '' });
      openOrder();
    });
  });
  if (location.hash === '#order') { history.replaceState(null, '', location.pathname + location.search); }

  /* ---------- コピー（T11） ---------- */
  var live = $('#liveMsg');
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy'), t = $('.copy-t', b);
      function ok() {
        track('code_copy', { code: text });
        t.textContent = 'コピーしました'; b.classList.add('done'); live.textContent = 'コード ' + text + ' をコピーしました';
        setTimeout(function () { t.textContent = 'コピー'; b.classList.remove('done'); live.textContent = ''; }, 2000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text); ok(); });
      } else { fallbackCopy(text); ok(); }
    });
  });
  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
  }
  $$('[data-contact]').forEach(function (a) { a.addEventListener('click', function () { track('contact_click', {}); }); });

  /* ---------- 追従バー（T04） ---------- */
  var stk = $('#stk'), fvOut = false, finalIn = false, footIn = false;
  function syncSticky() { stk.hidden = !(fvOut && !finalIn && !footIn) || dlg.open; }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { es.forEach(function (e) { fvOut = !e.isIntersecting && e.boundingClientRect.top < 0; }); syncSticky(); }).observe($('#fvBtn'));
    new IntersectionObserver(function (es) { es.forEach(function (e) { finalIn = e.isIntersecting; }); syncSticky(); }, { rootMargin: '0px 0px -80px 0px' }).observe($('#final .btn'));
    new IntersectionObserver(function (es) { es.forEach(function (e) { footIn = e.isIntersecting; }); syncSticky(); }).observe($('#footer'));
  }

  /* ---------- 入力チェック ---------- */
  var FIELDS = ['name', 'kana', 'email', 'phone', 'postal', 'pref', 'address1', 'address2', 'consent'];
  function normDigits(v) { return toHalf(v).replace(/[\s\-－ー―‐]/g, ''); }
  function hira2kata(s) { return s.replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); }); }
  var CHECK = {
    name: function () { var v = val('name').trim(); return v && v.length <= 50 ? '' : 'お名前を入力してください。'; },
    kana: function () { var v = hira2kata(val('kana').trim()); return /^[ァ-ヶー・\u3000 ]+$/.test(v) && v.length <= 60 ? '' : '全角カタカナで入力してください。'; },
    email: function () { var v = val('email').trim(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254 ? '' : 'メールアドレスの形式をご確認ください。'; },
    phone: function () { return /^0\d{9,10}$/.test(normDigits(val('phone'))) ? '' : 'ハイフンなしの10〜11桁の数字で入力してください。'; },
    postal: function () { return /^\d{7}$/.test(normDigits(val('postal'))) ? '' : 'ハイフンなしの7桁の数字で入力してください。'; },
    pref: function () { return PREFS.indexOf(val('pref')) >= 0 ? '' : '都道府県を選択してください。'; },
    address1: function () { var v = val('address1').trim(); return v && v.length <= 100 ? '' : '市区町村・番地を入力してください。'; },
    address2: function () { return val('address2').length <= 100 ? '' : '100文字以内で入力してください。'; },
    consent: function () { return form.elements.namedItem('consent').checked ? '' : '同意が必要です。'; }
  };
  function setErr(name, msg) {
    var inp = form.elements.namedItem(name), e = $('#e-' + name);
    if (e) e.textContent = msg || '';
    if (inp && inp.setAttribute) { if (msg) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid'); }
  }
  function clearErrors() { FIELDS.forEach(function (n) { setErr(n, ''); }); }
  FIELDS.forEach(function (n) {
    var inp = form.elements.namedItem(n); if (!inp) return;
    inp.addEventListener('blur', function () {
      if (n === 'kana') inp.value = hira2kata(inp.value);
      if (n === 'phone' || n === 'postal') inp.value = normDigits(inp.value);
      if (n !== 'consent') setErr(n, CHECK[n]());
    });
    if (n === 'consent' || n === 'pref') inp.addEventListener('change', function () { setErr(n, CHECK[n]()); });
  });
  function validateAll() {
    var first = null;
    FIELDS.forEach(function (n) { var m = CHECK[n](); setErr(n, m); if (m && !first) first = n; });
    if (first) {
      var inp = form.elements.namedItem(first); if (inp && inp.focus) inp.focus();
      if (inp && inp.scrollIntoView) inp.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return !first;
  }

  /* ---------- 確認ビュー ---------- */
  function buildConfirm() {
    var list = $('#cfmList'), c = calc(); list.textContent = '';
    function row(k, v, cls) { var d = el('div', cls || ''); d.appendChild(el('dt', '', k)); d.appendChild(el('dd', '', v)); list.appendChild(d); }
    row('商品', 'Natura Loop DAILY BASE（60粒・約30日分）× 1');
    row('クーポン', state.coupon ? CODE + '（10%OFF）' : 'なし');
    row('お支払い', payment() === 'cod' ? 'コンビニ後払い' : 'クレジットカード');
    row('お名前', val('name').trim());
    row('フリガナ', hira2kata(val('kana').trim()));
    row('メール', val('email').trim());
    row('電話', normDigits(val('phone')));
    var p = normDigits(val('postal'));
    row('お届け先', '〒' + p.slice(0, 3) + '-' + p.slice(3) + ' ' + val('pref') + val('address1').trim() + ' ' + val('address2').trim());
    row('お知らせ', form.elements.namedItem('newsletter').checked ? '受け取る' : '受け取らない');
    row('商品代金', yen(PRICE));
    if (c.d) row('割引', '−' + yen(c.d));
    row('送料', yen(SHIP));
    if (c.fee) row('手数料', yen(c.fee));
    row('合計（税込）', yen(c.total), 'tot');
  }
  $('#toConfirm').addEventListener('click', function () {
    if (!validateAll()) return;
    buildConfirm(); showView('confirm');
  });
  $('#backEdit').addEventListener('click', function () { showView('input'); });

  /* ---------- 送信（GAS） ---------- */
  function payload() {
    return {
      hp_check: val('hp_check'),
      name: val('name').trim(), kana: hira2kata(val('kana').trim()), email: val('email').trim(),
      phone: normDigits(val('phone')), postal: normDigits(val('postal')), pref: val('pref'),
      address1: val('address1').trim(), address2: val('address2').trim(),
      payment: payment(), coupon: state.coupon,
      newsletter: form.elements.namedItem('newsletter').checked,
      consent: form.elements.namedItem('consent').checked, qty: 1
    };
  }
  function sendOrder(data) {
    var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 20000);
    return fetch(C.GAS_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data), signal: ctrl.signal
    }).then(function (r) { return r.json(); }).then(function (j) { clearTimeout(timer); return j; }, function (e) { clearTimeout(timer); throw e; });
  }
  function formErr(msg) { var e = $('#formErr'); e.textContent = msg; e.hidden = false; }
  function setSending(on) {
    state.sending = on; $('#submitBtn').classList.toggle('is-sending', on);
    $('#submitBtn').disabled = on; $('#backEdit').disabled = on;
    $('#submitT').textContent = on ? '送信中…' : 'この内容で注文を確定する';
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (state.view !== 'confirm' || state.sending) return;
    if (!C.GAS_URL || /YOUR_/.test(C.GAS_URL)) { formErr(MSG.NO_GAS); return; }
    setSending(true); $('#formErr').hidden = true;
    var wantNews = form.elements.namedItem('newsletter').checked;
    sendOrder(payload()).then(function (r) {
      setSending(false);
      if (r && r.ok) { complete(r, wantNews); return; }
      var code = (r && r.error) || 'SERVER_ERROR';
      if (code.indexOf('COUPON_') === 0) {
        state.coupon = ''; state.removed = true; cpnInput.value = ''; cpnRemove.hidden = true;
        setCpn(MSG[code] || MSG.COUPON_INVALID, 'ng'); renderSum(); showView('input'); formErr(MSG[code] || MSG.COUPON_INVALID);
        return;
      }
      if (code === 'INVALID_INPUT' && r.fields) {
        showView('input'); r.fields.forEach(function (n) { setErr(n, '入力内容をご確認ください。'); }); formErr(MSG.INVALID_INPUT); return;
      }
      formErr(MSG[code] || MSG.SERVER_ERROR);
    }).catch(function () { setSending(false); formErr(MSG.NETWORK); });
  });
  function complete(r, wantNews) {
    $('#doneNo').textContent = r.orderNo || '';
    $('#doneTotal').textContent = yen(r.total != null ? r.total : calc().total);
    $('#doneMail').textContent = r.mail === 'NG'
      ? '確認メールの送信に失敗しました。注文番号を控えて、お問い合わせください。'
      : r.mail === 'SKIP'
        ? 'ご注文は受け付けました。ただいま確認メールの送信を見合わせています。注文番号を控えて、ご不明点はお問い合わせください。'
        : '確認メールを送りました。届かない場合は迷惑メールフォルダをご確認ください。';
    track('purchase', { transaction_id: r.orderNo, value: r.total, currency: 'JPY', coupon: state.coupon || '' });
    if (wantNews) track('newsletter_signup', {});
    form.reset(); clearErrors(); state.coupon = ''; state.removed = false; cpnInput.value = ''; cpnRemove.hidden = true; setCpn('', '');
    showView('done');
  }

  /* ---------- 規約等（課題用の仮置き） ---------- */
  var LEGAL = {
    tokusho: ['特定商取引法に基づく表記', '<p class="tmp">課題用の仮設定（架空）です。実案件ではクライアントの確定情報に差し替えます。</p><table><tr><th>販売業者</th><td>ナチュラループ株式会社（架空）</td></tr><tr><th>運営統括責任者</th><td>山田 花子（架空）</td></tr><tr><th>所在地</th><td>〒000-0000 東京都○○区○○ 0-0-0（架空）</td></tr><tr><th>電話</th><td>03-0000-0000（平日10:00〜17:00）</td></tr><tr><th>メール</th><td>support@natura-loop.example</td></tr><tr><th>販売価格</th><td>3,240円（税込）／キャンペーン価格2,916円（税込）</td></tr><tr><th>必要料金</th><td>送料550円（税込・全国一律）、コンビニ後払い手数料220円（税込）</td></tr><tr><th>お支払い</th><td>クレジットカード／コンビニ後払い（本ストアでは決済を行いません）</td></tr><tr><th>引渡時期</th><td>ご注文から3営業日以内に出荷</td></tr><tr><th>返品・交換</th><td>到着後8日以内、未開封・未使用に限り返品可（返送料はお客様負担）。商品不良・誤配送は当社負担で交換。</td></tr></table>'],
    terms: ['利用規約', '<p class="tmp">課題用の仮置きです。法的文書の本文ではありません。</p><h3>キャンペーン</h3><p>2026年11月1日〜11月30日。初めてご購入の方が対象。1人1回・1注文1点まで。他のクーポン・割引とは併用できません。割引は商品本体のみが対象です。</p><h3>ご注文</h3><p>単品購入です。自動継続・定期購入はありません。キャンセルは出荷前に限り、メールで承ります。</p><h3>禁止事項</h3><p>虚偽の情報の入力、転売目的の購入、システムへの不正なアクセスを禁止します。</p>'],
    privacy: ['プライバシーポリシー', '<p class="tmp">課題用の仮置きです。法的文書の本文ではありません。</p><h3>利用目的</h3><p>注文処理・決済確認・配送・問い合わせ対応のために利用します。メールマガジンは、任意で同意した方にのみ配信します。</p><h3>保存期間</h3><p>注文情報は取引終了後5年、問い合わせ履歴は対応完了後2年、メールマガジンの配信先は配信停止まで。</p><h3>委託先・第三者提供</h3><p>決済代行会社、配送事業者、メール配信サービスに業務を委託する場合があります。法令に基づく場合を除き、本人の同意なく第三者へ提供しません。</p><h3>開示・訂正・削除</h3><p>support@natura-loop.example までご連絡ください。</p><h3>Cookie・アクセス解析</h3><p>アクセス解析（GA4）を利用する場合があります。</p>'],
    shipping: ['返品・配送条件', '<h3>配送</h3><p>ご注文から3営業日以内に出荷し、出荷後1〜3日程度でお届けします（地域により異なります）。ポスト投函のため、配送日時の指定はできません。送料は全国一律550円（税込）です。</p><h3>返品・交換</h3><p>商品到着後8日以内、未開封・未使用に限り返品できます（返送料はお客様負担）。商品不良・誤配送は当社負担で交換します。</p><h3>キャンセル</h3><p>出荷前に限り、注文番号を添えてメールでご連絡ください。</p>']
  };
  $$('[data-legal]').forEach(function (b) {
    b.addEventListener('click', function () {
      var d = LEGAL[b.getAttribute('data-legal')]; if (!d) return;
      $('#lgTitle').textContent = d[0]; $('#lgBody').innerHTML = d[1];
      if (typeof legal.showModal === 'function') legal.showModal(); else legal.setAttribute('open', '');
    });
  });
  $('#lgClose').addEventListener('click', function () { closeDlg(legal); });

  renderSum();
  syncSticky();
})();
