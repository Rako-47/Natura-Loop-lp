/**
 * Natura Loop DAILY BASE 注文受付（課題用・架空ストア）
 * デプロイ：ウェブアプリ／実行ユーザー＝自分／アクセス＝全員
 * スクリプトプロパティ：SHEET_ID（必須）, ADMIN_EMAIL, REPLY_TO, TEST_MODE
 */
const CFG = {
  PRICE: 3240, SHIPPING: 550, COD_FEE: 220, RATE: 0.1, COUPON: 'BASE10',
  START: new Date('2026-11-01T00:00:00+09:00'),
  END: new Date('2026-11-30T23:59:59+09:00'),
  SHEET: 'orders', FROM_NAME: 'Natura Loop（課題用）',
  MAIL_DAILY_LIMIT: 80 // メール送信の1日上限（スクリプトプロパティ MAIL_DAILY_LIMIT で変更可）
};
const PREFS = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
const HEADERS = ['注文番号','受付日時','氏名','フリガナ','メール','電話','郵便番号','都道府県','住所1','住所2','支払い方法','クーポン','商品代金','割引','送料','手数料','合計','メルマガ','メール送信','メールキー','住所キー'];
const COL = {}; HEADERS.forEach((h, i) => { COL[h] = i; });

const prop_ = k => PropertiesService.getScriptProperties().getProperty(k);
const json_ = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const yen_ = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
// スプレッドシートの数式として解釈されないようにする
const safe_ = v => { v = String(v == null ? '' : v).trim(); return /^[=+\-@]/.test(v) ? String.fromCharCode(39) + v : v; };

function sheet_() {
  const ss = SpreadsheetApp.openById(prop_('SHEET_ID'));
  return ss.getSheetByName(CFG.SHEET) || ss.insertSheet(CFG.SHEET);
}

// メール送信数の1日上限。日本時間で日付が変わるとリセットされる。
// 顧客宛の確認メールは、上限に達したら送らない（注文は受け付ける）。
// 管理者宛の通知は上限を超えても送る（Googleの実際の残り枠がある間だけ）。
// doPost の ScriptLock の内側で呼ぶこと（同時実行でカウントがずれないように）。
function mailLimit_() {
  const n = Number(prop_('MAIL_DAILY_LIMIT'));
  return n > 0 ? n : CFG.MAIL_DAILY_LIMIT;
}
function reserveMail_(isAdmin) {
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd');
  const parts = String(props.getProperty('MAIL_COUNT') || '').split(':');
  const used = parts[0] === today ? (Number(parts[1]) || 0) : 0;
  if (!isAdmin && used + 1 > mailLimit_()) return false;
  if (MailApp.getRemainingDailyQuota() < 1) return false;
  props.setProperty('MAIL_COUNT', today + ':' + (used + 1)); // 送信前に数える（失敗しても数える＝安全側）
  return true;
}

// 最初に1回だけ手動で実行（権限の承認もここで行う）
function setup() {
  const sh = sheet_();
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  sh.setFrozenRows(1);
  sh.getRange(1, COL['電話'] + 1, sh.getMaxRows(), 2).setNumberFormat('@'); // 電話・郵便番号を文字列にする
  MailApp.getRemainingDailyQuota();
}

function doGet() { return json_({ ok: true, service: 'natura-loop-orders' }); }

function doPost(e) {
  let p;
  try { p = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'INVALID_INPUT' }); }
  if (p.hp_check) return json_({ ok: true, orderNo: '-' }); // ハニーポット
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ ok: false, error: 'BUSY' });
  try { return json_(handle_(p)); }
  catch (err) { console.error(err); return json_({ ok: false, error: 'SERVER_ERROR' }); }
  finally { lock.releaseLock(); }
}

function validate_(p) {
  const f = [];
  const s = (x, max) => typeof x === 'string' && x.trim().length > 0 && x.length <= max;
  if (!s(p.name, 50)) f.push('name');
  if (!(s(p.kana, 60) && /^[ァ-ヶー・\u3000 ]+$/.test(p.kana))) f.push('kana');
  if (!(s(p.email, 254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim()))) f.push('email');
  if (!(typeof p.phone === 'string' && /^0\d{9,10}$/.test(p.phone.replace(/-/g, '')))) f.push('phone');
  if (!(typeof p.postal === 'string' && /^\d{7}$/.test(p.postal.replace(/-/g, '')))) f.push('postal');
  if (PREFS.indexOf(p.pref) < 0) f.push('pref');
  if (!s(p.address1, 100)) f.push('address1');
  if (p.address2 && String(p.address2).length > 100) f.push('address2');
  if (['card', 'cod'].indexOf(p.payment) < 0) f.push('payment');
  if (p.consent !== true) f.push('consent');
  if (Number(p.qty) !== 1) f.push('qty');
  return { ok: f.length === 0, fields: f };
}

function handle_(p) {
  const v = validate_(p);
  if (!v.ok) return { ok: false, error: 'INVALID_INPUT', fields: v.fields };
  const email = p.email.trim().toLowerCase();
  const cache = CacheService.getScriptCache();
  if (cache.get('rl_' + email)) return { ok: false, error: 'BUSY' };
  const postal = p.postal.replace(/-/g, '');
  const phone = p.phone.replace(/-/g, '');
  const addrKey = [p.name, postal, p.address1, p.address2 || ''].join('|').replace(/[\s\u3000]/g, '').toLowerCase();
  const sh = sheet_();
  const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.length).getValues() : [];
  const returning = rows.some(r => r[COL['メールキー']] === email || r[COL['住所キー']] === addrKey);

  let discount = 0, coupon = '';
  const code = String(p.coupon || '').trim().toUpperCase();
  if (code) {
    if (code !== CFG.COUPON) return { ok: false, error: 'COUPON_INVALID' };
    const now = new Date(), test = prop_('TEST_MODE') === 'true';
    if (!test && now < CFG.START) return { ok: false, error: 'COUPON_NOT_STARTED' };
    if (!test && now > CFG.END) return { ok: false, error: 'COUPON_EXPIRED' };
    if (returning) return { ok: false, error: 'COUPON_NOT_ELIGIBLE' };
    discount = Math.floor(CFG.PRICE * CFG.RATE); coupon = code;
  }
  const fee = p.payment === 'cod' ? CFG.COD_FEE : 0;
  const total = CFG.PRICE - discount + CFG.SHIPPING + fee; // 金額は必ずサーバーで計算する
  const at = new Date();
  const orderNo = 'NL' + Utilities.formatDate(at, 'Asia/Tokyo', 'yyMMdd') + '-' + ('000' + sh.getLastRow()).slice(-4);
  const o = { orderNo, name: p.name.trim(), kana: p.kana.trim(), email: p.email.trim(), phone, postal, pref: p.pref,
    address1: p.address1.trim(), address2: String(p.address2 || '').trim(), payment: p.payment, coupon, discount, fee, total };

  sh.appendRow([
    orderNo, Utilities.formatDate(at, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
    safe_(o.name), safe_(o.kana), safe_(o.email), o.phone, o.postal, o.pref, safe_(o.address1), safe_(o.address2),
    o.payment === 'cod' ? 'コンビニ後払い' : 'クレジットカード', coupon, CFG.PRICE, discount, CFG.SHIPPING, fee, total,
    p.newsletter === true ? 'はい' : 'いいえ', '', email, addrKey
  ]);
  const row = sh.getLastRow();

  let mail = 'OK'; // OK=送信済み / SKIP=1日の上限で未送信 / NG=送信失敗
  try {
    if (reserveMail_(false)) {
      const opt = { to: o.email, subject: '【Natura Loop】ご注文ありがとうございます（注文番号：' + orderNo + '）', body: mailBody_(o), name: CFG.FROM_NAME };
      if (prop_('REPLY_TO')) opt.replyTo = prop_('REPLY_TO');
      MailApp.sendEmail(opt);
    } else {
      mail = 'SKIP';
    }
  } catch (err) { mail = 'NG'; console.error(err); }
  try {
    if (prop_('ADMIN_EMAIL') && reserveMail_(true)) {
      const note = mail === 'OK' ? '送信済み' : (mail === 'SKIP' ? '1日の上限のため未送信' : '送信失敗');
      MailApp.sendEmail(prop_('ADMIN_EMAIL'), '[新規注文] ' + orderNo + ' ' + yen_(total) + '円', mailBody_(o) + '\n\n※顧客への確認メール：' + note);
    }
  } catch (err) { console.error(err); }
  sh.getRange(row, COL['メール送信'] + 1).setValue(mail);
  cache.put('rl_' + email, '1', 30); // 同じメールの連続送信を30秒止める
  return { ok: true, orderNo, total, discount, fee, mail };
}

function mailBody_(o) {
  return [
    o.name + ' 様', '',
    'ご注文ありがとうございます。（※課題用の架空ストアです）', '',
    '■ご注文番号：' + o.orderNo,
    '■商品：Natura Loop DAILY BASE（60粒・約30日分）× 1',
    '■商品代金：' + yen_(CFG.PRICE) + '円（税込）',
    o.discount ? '■キャンペーン割引（10%OFF）：-' + yen_(o.discount) + '円' : null,
    '■送料：' + yen_(CFG.SHIPPING) + '円（税込）',
    o.fee ? '■コンビニ後払い手数料：' + yen_(o.fee) + '円（税込）' : null,
    '■合計：' + yen_(o.total) + '円（税込）',
    '■お支払い方法：' + (o.payment === 'cod' ? 'コンビニ後払い' : 'クレジットカード'), '',
    '■お届け先', '〒' + o.postal, o.pref + o.address1 + ' ' + o.address2, o.name + ' 様', '',
    '■発送について', 'ご注文から3営業日以内に出荷します。ポスト投函のため、配送日時の指定はできません。', '',
    '■返品について', '到着後8日以内、未開封・未使用に限り返品できます（返送料はお客様負担）。商品不良・誤配送は当社負担で交換します。', '',
    'ご不明点：support@natura-loop.example（平日10:00〜17:00）', 'ナチュラループ株式会社（架空）'
  ].filter(l => l !== null).join('\n');
}
