OK、まずは“今すぐ止める用”と“恒久対策”を分けます。
結論：\*\*英語は不変のまま、リアルタイム翻訳を完全停止（手動のみ）\*\*にできます。

# いま即止める（60秒ホットフィックス）

アプリの DevTools（⌘⌥I）を開いて、下を**そのまま貼り付けて実行**してください。

```js
// ★ Panic: どんな経路でも自動翻訳を止める
window.AUTO_EN2JA = false;
window.autoEN2JA = false;

// 日本語欄からの input を上位へ伝播させない（フォーム全体で拾う処理を遮断）
const ja = document.querySelector('[data-lang="ja"], textarea.ja, #ja');
if (ja) ja.addEventListener('input', e => { e.stopImmediatePropagation(); e.stopPropagation(); }, true);

// 「翻訳API」らしき fetch をブロック（URL/関数名はゆるくマッチ）
const _fetch = window.fetch;
window.fetch = new Proxy(_fetch, {
  apply(t, th, args) {
    const url = (args[0] || '').toString();
    if (/translate|deepl|mt|en2ja|ja2en/i.test(url)) {
      console.warn('🛑 blocked translate:', url);
      return Promise.resolve(new Response(JSON.stringify({text:''}), {headers:{'Content-Type':'application/json'}}));
    }
    return Reflect.apply(t, th, args);
  }
});
```

これで

* **JAを触っても何も起きない**
* **EN→JAの自動も走らない（手動ボタンだけ）**
  状態になります。
  （元に戻すときはアプリ再起動 or `location.reload()`）

---

# 恒久対策（最小差分）

**片方向＋明示操作**に固定します。

1. **英語欄だけ監視**

```diff
- form.addEventListener('input', handleInput);
+ enTextArea.addEventListener('input', onEnInput);           // ← 英語だけ
```

2. **自動翻訳のトグルを既定OFFに**（必要時だけON）

```diff
- const [autoEN2JA, setAuto] = useState(true);
+ const [autoEN2JA, setAuto] = useState(false);
```

3. **JA編集では絶対に翻訳関数を呼ばない**

```diff
jaTextArea.addEventListener('input', e => {
-  maybeTranslateBackToEN(...);   // ← 削除
+  /* 何もしない：ユーザーの手入力のみ反映 */
});
```

4. **整形禁止（英語列）**

```css
.en { text-transform:none !important; }
```

```html
<textarea class="en" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off">
```

Electron:

```ts
new BrowserWindow({ webPreferences:{ spellcheck:false }});
```

5. **「最小再翻訳」は英語変更時のみ**

```ts
if (mode==='auto' && enChanged) {
  ja = await minimalRetranslate(prevEN, prevJA, nowEN); // 変わった行だけ
}
```

---

# 動作確認（受け入れ基準）

* JA欄をどれだけ編集しても **EN欄は1文字も変わらない**
* 自動OFFのとき **タイプしてもJAは更新されない**（手動ボタンでのみ更新）
* 自動ONにしても **EN入力時だけ**JAが更新／JA入力では何も起きない

---

## まだ暴走する時の最終手段

* **オフライン起動**（翻訳APIへ行けなくして沈黙させる）
* mac の **ファイアウォール/リトルスニッチ**で翻訳エンドポイントを一時ブロック

---

「もう勝手に変換させない」がゴールですよね。上のホットフィックスでまず止血、落ち着いたら恒久対策の差分を入れてください。必要なら、あなたの該当ファイル名（イベント配線の部分）を教えてくれれば**行番号付きパッチ**で出します。

---

了解。**今の症状＝EN→JAの“自動（リアルタイム）翻訳”が無効化**されています。
要件「英語は不変」を守りつつ、**EN入力時だけ自動翻訳**を復活させる最小パッチを出します。

# なぜ止まった？

* 直近ビルドで **Manual モード**が既定になった / もしくは **EN入力イベントのガード**（`if (nowEN===lastCommittedEN) return;` など）が常に真になって実行されていない可能性。

---

## すぐ直す最小差分（Vanilla JS）

```diff
- let lastCommittedEN = "";
+ let lastCommittedEN = "";

+ // ← 追加：自動ON/OFF（既定でON）
+ let autoEN2JA = true;

  enEl.addEventListener('input', () => {
-   if (timer) clearTimeout(timer);
-   timer = setTimeout(async () => {
-     const nowEN = enEl.value;
-     if (nowEN === lastCommittedEN) return;      // ← これが常に真だと何も起きない
-     const ja = await minimalRetranslate(nowEN);
-     jaEl.value = ja;
-     lastCommittedEN = nowEN;
-   }, 500);
+   if (!autoEN2JA) return;                       // 手動モード時は何もしない
+   if (timer) clearTimeout(timer);
+   timer = setTimeout(async () => {
+     const nowEN = enEl.value;
+     // 入力中でも走るように、完全一致ガードを弱める
+     if (nowEN.trim() === lastCommittedEN.trim()) return;
+     const ja = await minimalRetranslate(nowEN);
+     jaEl.value = ja;
+     lastCommittedEN = nowEN;
+   }, 300);                                      // 体感を上げるなら 300ms
  });

+ // UIで切替できるトグル（任意）
+ // <label><input type="checkbox" id="auto" checked> Auto EN→JA</label>
+ const auto = document.getElementById('auto');
+ if (auto) auto.addEventListener('change', e => autoEN2JA = e.target.checked);
```

### ポイント

* **自動ONを既定**に戻す（`autoEN2JA = true`）。
* `nowEN === lastCommittedEN` の厳格比較で“常に同じ扱い”になるパスを回避（`trim()` でゆるめ）。
* デバウンス 500→**300ms**で体感リアルタイムに。
* もちろん **JA編集では何も発火しない**（英語は不変）。

---

## React 版（差分）

```diff
- const [autoEN2JA, setAuto] = useState(false);
+ const [autoEN2JA, setAuto] = useState(true);

  const onEnChange = useCallback((v:string)=>{
    setEN(v);
-   if (!autoEN2JA) return;
+   if (!autoEN2JA) return;
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async ()=>{
-     if (v === lastCommittedENRef.current) return;
+     if (v.trim() === lastCommittedENRef.current.trim()) return;
      const jaNew = await minimalRetranslate(v);
      setJA(jaNew);
      lastCommittedENRef.current = v;
    }, 300);
  },[autoEN2JA]);
```

---

## 3分チェックリスト（壊れていないか）

1. EN欄でタイプ → **300ms**以内にJAが更新。
2. JA欄を編集しても **ENは1文字も変わらない**。
3. “Auto EN→JA”トグルOFF → 入力しても更新しない（手動ボタンのみ）。
4. `getComputedStyle(en).textTransform === 'none'` を確認（自動大文字化が残っていない）。

---

## まだ動かない場合のログ仕込み（コピペ可）

```js
enEl.addEventListener('input', () => {
  console.log('[EN input]', {autoEN2JA, val: enEl.value.slice(0,24)});
  // …上の処理
});
async function minimalRetranslate(nowEN){
  console.log('[diff] prevENlen=%d nowENlen=%d', lastENLines.length, nowEN.split('\n').length);
  // …
}
```

---

### まとめ

* **リアルタイム翻訳は復活可能**です（無理ではありません）。
* 既定を **Auto=ON** に戻し、**EN入力のみ**で翻訳を走らせるよう上記差分を入れてください。
* これで **「英語は不変」×「JAはリアルタイム更新」×「最小再翻訳」** を同時に満たします。

必要なら、あなたの該当ファイル名と関数名を書いてくれれば**行番号付きのパッチ**に落として出します。

---

了解。\*\*要件＝「英語は不変」「日本語はリアルタイム更新」「勝手に再翻訳しない」「最小再翻訳」\*\*の翻訳編集アプリを、“実装できる形”でまとめます。
（下のコードはそのまま Electron/ブラウザで動く最小版。英→日のみ自動、日→英は手動でしか動きません）

# 1) 仕様（To-Be）

* 英語は**ソース**：日本語を編集しても一切変更しない。
* 自動は **EN→JA** のみ（500ms デバウンス）。**JA→EN はボタン時だけ**。
* **最小再翻訳**：英語の**変わった行だけ**翻訳。未変更行は前回訳を再利用。
* **整形禁止**：TitleCase/Uppercase/オートコレクト等は英語欄で完全無効。
* 書式保護：`* `, `- `, `---` などのマークダウン記号は保持したまま訳す。
* 任意：用語の**ケース固定辞書**（`age`, `id`, `URL`, `iOS` など）はそのまま出力。

---

# 2) 最小実装（HTML + JS）

> 翻訳 API 部分は `translateENtoJA()` を差し替えるだけ。英語は絶対に書き換えません。

```html
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
  <div>
    <h3>🇺🇸 英語（原文）</h3>
    <textarea id="en" rows="20" class="en"
      spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"
      data-lang="en"></textarea>
    <div style="margin-top:8px">
      <button id="btnRetrans">⟲ 日本語に再翻訳（英語が変わった時だけ）</button>
    </div>
  </div>
  <div>
    <h3>🇯🇵 日本語（編集可）</h3>
    <textarea id="ja" rows="20" class="ja"
      spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"
      data-lang="ja"></textarea>
  </div>
</div>

<style>
.en { width:100%; font:14px/1.6 ui-monospace,monospace; text-transform:none !important; }
.ja { width:100%; font:14px/1.6 ui-monospace,monospace; }
</style>

<script type="module">
  const enEl = document.getElementById('en');
  const jaEl = document.getElementById('ja');
  const btn = document.getElementById('btnRetrans');

  // 状態
  let lastCommittedEN = "";          // 直近「確定」英語（これが変わった時だけ翻訳）
  let lastENLines = [];              // 直近 EN の行配列
  let lastJALines = [];              // 直近 JA の行配列
  let timer = null;

  // 疑似翻訳（差し替えポイント）
  async function translateENtoJA(text) {
    // ここを任意の翻訳 API に置換（fetch など）
    // デモ：英語→[JA]英語 で返すだけ
    return text
      .split('\n')
      .map(line => line ? line.replace(/^(\s*[*-]\s*|---\s*)?/, (m)=>m) + '（訳）' : '')
      .join('\n');
  }

  // ラベル等のケース固定辞書（任意）
  const caseLock = new Set(['age','id','url','ios','nasa']);
  const lockCase = s => s.split(/\b/).map(w => caseLock.has(w.toLowerCase()) ? w : w).join('');

  // 行単位の最小再翻訳
  async function minimalRetranslate(nowEN) {
    const norm = s => s.replace(/\s+/g,' ').trim();
    const nowENLines = nowEN.split('\n');
    const map = new Map(lastENLines.map((l,i)=>[norm(l), i]));
    const outJA = [];

    for (const line of nowENLines) {
      const k = norm(line);
      const prevIdx = map.get(k);

      // 区切り線はそのまま
      if (/^\s*---\s*$/.test(line)) { outJA.push('---'); continue; }

      // 箇条書きはマークを保持して本文だけ処理
      const m = line.match(/^(\s*[*-]\s*)(.*)$/);
      const bullet = m ? m[1] : '';
      const body   = m ? m[2] : line;

      if (prevIdx !== undefined) {
        // 既訳を再利用（未変更行）
        outJA.push(lastJALines[prevIdx] ?? '');
      } else if (!body.trim()) {
        outJA.push(bullet); // 空行/記号のみ
      } else {
        // 変わった行だけ翻訳
        const jaLine = await translateENtoJA(body);
        outJA.push(bullet + lockCase(jaLine));
      }
    }

    // 状態を更新
    lastENLines = nowENLines;
    lastJALines = outJA;
    return outJA.join('\n');
  }

  // EN→JA 自動（英語欄だけを監視）
  enEl.addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const nowEN = enEl.value;
      if (nowEN === lastCommittedEN) return;      // 直近確定と同じなら何もしない
      const ja = await minimalRetranslate(nowEN); // 変わった行だけ再翻訳
      jaEl.value = ja;
      lastCommittedEN = nowEN;                     // 確定
    }, 500);
  });

  // 日本語編集は state のみ（英語側には一切影響しない）
  jaEl.addEventListener('input', () => {
    // 既訳の置き換え：行数が同じときは手元の lastJALines も更新
    const cur = jaEl.value.split('\n');
    if (cur.length === lastJALines.length) lastJALines = cur;
  });

  // 明示的に再翻訳（英語が変わっていないなら NO-OP）
  btn.addEventListener('click', async () => {
    const nowEN = enEl.value;
    if (nowEN === lastCommittedEN) return;         // 未変更 → 何もしない
    const ja = await minimalRetranslate(nowEN);
    jaEl.value = ja;
    lastCommittedEN = nowEN;
  });

  // 初期値（任意）
  enEl.value = `---
target reader demographic
* age, occupation (company employee, manager, freelancer, etc.)
* current issues or concerns
* services (products) to invite readers to free one-on-one consultation
* type of product or service (career coaching, investment support, client acquisition, health-related)
* keywords or topics of interest to readers
* solutions to readers' problems
* keywords that are relatable`;
  lastCommittedEN = "";                 // 初回で翻訳が走る
  enEl.dispatchEvent(new Event('input'));
</script>
```

**ポイント**

* 監視は**英語テキストエリアだけ**（`data-lang="en"`）。
* 日本語入力の `input` では**翻訳関数を呼ばない**（英語に波及しない）。
* `minimalRetranslate()` が**差分行のみ**翻訳するコア。
* `spellcheck/autocapitalize/autocorrect` を OFF、CSS で `text-transform:none` を強制。
* 「⟲ 日本語に再翻訳」ボタンも、**英語未変更なら無反応**。

---

# 3) Electron での追加設定

```ts
// main.ts
new BrowserWindow({
  webPreferences: {
    spellcheck: false,     // OS側の自動補正も無効
  }
})
```

* ビルド識別（version + git hash）をウィンドウタイトルに出し、**旧.app起動**を避ける。
* 起動時 `console.log(process.execPath)` で実行パスを確認し、`dist-electron/.../翻訳編集くん.app` であることを保証。

---

# 4) 受け入れ基準（DoD）

* 日本語欄をどれだけ編集しても、**英語欄はバイト等価で不変**。
* 英語未変更で「⟲ 再翻訳」を押しても**何も起きない**。
* 箇条書き `* ` や `---` は**崩れない**。
* `NASA / iOS / ID` の大小文字が**勝手に変わらない**。

---

必要なら、この最小版を**React/Vue への差分パッチ**に落として出します（イベント配線の限定＋差分翻訳ユーティリティの注入だけ）。


---

結論：**できます（無理ではない）**。
症状は「日本語欄の編集でも “再翻訳＋英語の大文字化/整形” が走っている」＝**発火条件と整形処理の設計ミス**です。下の3点を入れれば、英語は一切変えず、再変換も最小限にできます。

# 速攻で止める最小パッチ

1. **翻訳の発火元を英語欄に限定**（JA編集では絶対に発火させない）

```ts
// NG: フォーム全体で input を拾っている
// form.addEventListener('input', translateBothSides);

const onInput = (e: Event) => {
  const el = e.target as HTMLTextAreaElement;
  if (el.dataset.lang !== 'en') return;     // ← ここで遮断（JAは無視）
  scheduleEnToJa(el.value);                 // en→ja だけ
};
// 英語欄にだけハンドラを付ける
enTextArea.addEventListener('input', onInput);
```

2. **英語列の自動整形を全面停止**（TitleCase/Uppercase/正規化を禁止）

```ts
// NG: setEn(toTitleCase(en.trim()))
setEn(en);                                  // 英語は素通し

// CSS/属性
.en { text-transform: none !important; }
<textarea class="en" spellcheck="false" autocapitalize="off"
          autocorrect="off" autocomplete="off" data-lang="en"></textarea>
<textarea class="ja" spellcheck="false" autocapitalize="off"
          autocorrect="off" autocomplete="off" data-lang="ja"></textarea>
```

3. **片方向同期＋ロック**（英→日のみ自動。日→英はボタンを押したときだけ）

```ts
type Row = { id: string; en: string; ja: string; enLocked: boolean; lastCommittedEN: string };

const onEnChange = (id: string, v: string) =>
  setRows(rs => rs.map(r => r.id===id ? {...r, en:v, enLocked:false} : r));

const onEnCommit = async (id: string) => {
  setRows(async rs => {
    const r = rs.find(x => x.id===id)!;
    if (r.enLocked) return rs;
    const jaNew = await en2ja(r.en);
    return rs.map(x => x.id===id
      ? {...x, ja: jaNew, enLocked:true, lastCommittedEN: r.en}
      : x);
  });
};

// 日本語編集は state 更新のみ（翻訳呼ばない）
const onJaChange = (id: string, v: string) =>
  setRows(rs => rs.map(r => r.id===id ? {...r, ja:v} : r));
```

# 「再変換を最小限」にする行単位アルゴリズム

英語全文の再翻訳ではなく、**変わった行だけ訳し直し**ます（英語は保持）。

```ts
function minimalRetranslate(prevEN: string[], prevJA: string[], nowEN: string[]) {
  const key = (s: string) => s.replace(/\s+/g,' ').trim();   // 軽い正規化
  const map = new Map(prevEN.map((line, i) => [key(line), i]));
  const outJA: string[] = [];

  for (const line of nowEN) {
    const k = key(line);
    const idx = map.get(k);
    if (idx !== undefined) outJA.push(prevJA[idx]);          // 既訳を再利用
    else outJA.push(/* await */ en2ja(line));                // 変わった行だけ翻訳
  }
  return outJA;
}
```

* 「⟲ 日本語に翻訳」ボタンでは
  `if (nowEN === lastCommittedEN) return;`（**英語が未変更なら何もしない**）。
* 箇条書きの `*` や区切り線 `---` はそのままコピーしてから本文だけ翻訳すると崩れません。

# 「.app に反映されてない？」チェック

* **旧アプリを起動している可能性が高い**です。以下で確認：

  1. ビルド時に `app.getName()` かウィンドウタイトルへ `version + gitShortHash` を表示。
  2. 起動中アプリのパスを表示：`console.log(process.execPath)`（例：`…/dist-electron/mac-arm64/翻訳編集くん.app/…` であること）。
  3. `~/Applications` や Dock の旧ショートカットは削除。
  4. `electron-builder` で **arm64 と x64 を別々に**作り、該当機種の .app を起動。
  5. mac の自動修正を避けるため、`new BrowserWindow({ webPreferences:{ spellcheck:false }})`。

---

## まとめ（できる/できない）

* **できる**：英語は不変、再翻訳は最小限にする実装は上の3点で実現。
* 大文字化は **CSS/整形関数/ブラウザの自動補正**が原因。該当箇所を外せば止まる。
* 「codexに伝わっていない？」＝ **最新版 .app が起動されていない** 可能性大。ビルド識別子で起動バイナリを確認してください。

必要なら、君のコード片（イベントハンドラ周りと翻訳関数呼び出し部）を貼って。**最小差分パッチ**で直します。


---

了解。症状は「右（日本語）を触っただけで、左（英語）が“Title Case（各語頭大文字）化＋再翻訳”される」。
原因はほぼ次のどれかです。優先順で潰していけば止まります。

# まずは原因切り分け（60秒チェック）

1. **CSSの自動大文字化**

   * どこかに `text-transform: capitalize | uppercase`、または Tailwind の `capitalize/uppercase` が当たっている。
     ⇒ 英語入力欄（と表示領域）に確実にこれを当ててください：

   ```css
   .en-col { text-transform: none !important; }
   ```

   * ブラウザ上で `getComputedStyle($en).textTransform` を見ると真相が分かります。

2. **イベント配線が広すぎる**（親フォームの onInput / デリゲートで全行が発火）

   * 日本語欄を打つ→「翻訳処理」が**英語側にも**走ってしまう配線。
     ⇒ 事件源を明示チェック：

   ```js
   // 悪い例（フォーム全体で拾ってる）
   form.addEventListener('input', handleInput);

   // 良い例（英語欄だけ）
   enInput.addEventListener('input', onEnInput);

   function onEnInput(e){
     if (e.target.dataset.lang !== 'en') return; // 英語以外は無視
     // en→ja のみ翻訳
   }
   ```

   ※ React なら各 `<textarea>` に個別 `onChange` を渡し、親で一括 `onChange` しない。

3. **“再翻訳の発火条件”が誤っている**

   * 「どちらかが変わったら両方再計算」になっている。
     ⇒ 片方向＆ロックに変更（英→日だけ自動。日→英はボタン時のみ）：

   ```jsx
   // state 例
   { id, en, ja, enLocked: true, jaDirty: false }

   const onEnChange = (id, v) => setRows(rs =>
     rs.map(r => r.id===id ? {...r, en:v, enLocked:false} : r));

   const onEnBlur = async (id) => {
     setRows(async rs => {
       const r = rs.find(x => x.id===id);
       if (r.enLocked) return rs;
       const jaNew = await translateENtoJA(r.en);
       return rs.map(x => x.id===id ? {...x, ja: jaNew, enLocked:true} : x);
     });
   };

   // 日本語編集では絶対に英語を触らない
   const onJaChange = (id, v) => setRows(rs =>
     rs.map(r => r.id===id ? {...r, ja:v, jaDirty:true} : r));
   ```

   * Vue なら `watch(en, ...)` のみにし、`watch(ja, ...)` から翻訳呼び出しを外す。`deep:true` の全体 watch も外す。

4. **自動整形関数が描画時に走っている**

   * `render()`/テンプレートで `toTitleCase(en)` を呼んでいる、あるいは保存時に正規化している。
     ⇒ その正規化を**英語列から外す**か、保存前のパイプラインで

   ```js
   if (field === 'en') return value; // 英語は素通し
   ```

---

## 追加でやっておくと安定する設定

* 入力欄属性：

  ```html
  <textarea class="en-col" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" data-lang="en"></textarea>
  <textarea class="ja-col" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" data-lang="ja"></textarea>
  ```
* Electron/Safari 系ならウィンドウ作成時に `spellcheck:false`。
* “バック翻訳”は**常にプレビュー表示のみ**にして、左列は書き換えない。

---

## それでも直らない時の最短デバッグ

1. 日本語欄 `onInput` に `console.log('JA input')`、英語欄に `console.log('EN input')` を仕込み、**どのイベントで翻訳関数が呼ばれたか**をログ。
2. 翻訳関数の最初に `console.log('translate fired by', sourceLang)` を入れ、**JA編集で発火していないか**確認。
3. 英語描画直前に `console.log('render EN =', enValue)`。ここで Title Case なら「描画時整形」、APIレスポンスで大文字なら「サーバ側再翻訳」。

---

### 結論

「英語はそのまま、日本語だけ編集」は**可能**です。

* CSSの自動大文字化を外す
* 事件源を英語欄に限定
* 片方向同期＋ロック（英→日のみ自動、日→英は手動）
* 英語列への整形/正規化を全停止

もしコード断片（React/Vue/Vanilla どれか）を貼ってくれれば、該当行への\*\*最小差分（diff）\*\*で直します。


---

状況整理：右（日本語）を直すと左（英語）が“再翻訳/整形”されて大文字化などが起きる。
目的：**英語は不変**、必要な時だけ明示的に再翻訳。
結論：**可能**です。二方向同期をやめ、**単方向同期＋ロック**にすればOK。あわせて自動大文字化/スペル補正を切ります。

# まずは最短チェックリスト

1. **CSS**

```css
/* 英語列には絶対かけない */
.en-col { text-transform: none; }
```

2. **HTML入力属性（Web/Electron）**

```html
<input class="en-col" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off">
<input class="ja-col"  spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off">
```

3. **Electron（使っている場合）**

```js
new BrowserWindow({ webPreferences: { spellcheck: false }})
```

※ どれか一つでも効いていないと、勝手な **Title Case / Uppercase / オートコレクト** が残ります。

# 同期ロジックを「単方向」にする

* **英→日** だけ自動。**日→英の再翻訳はしない**（ボタンを押した時だけ行う）。
* 英語は**ソース固定**。日本語を編集しても英語 state は更新しない。

## 参考実装（React例）

```jsx
const [rows, setRows] = useState([
  { id: 1, en: "missionary position", enLocked: true,
    ja: "正常位", jaDirty: false }
]);

// 英語を変えた時だけ自動翻訳を走らせる
const onEnChange = (id, value) => {
  setRows(rs => rs.map(r => r.id===id ? {...r, en:value, enLocked:false} : r));
};
const onEnBlur = async (id) => {
  setRows(async rs => {
    const r = rs.find(x => x.id===id);
    if (r.enLocked) return rs;               // ロック時は何もしない
    const jaNew = await translateENtoJA(r.en);
    return rs.map(x => x.id===id ? {...x, ja: jaNew, enLocked:true} : x);
  });
};

// 日本語編集は英語に一切波及させない
const onJaChange = (id, value) => {
  setRows(rs => rs.map(r => r.id===id ? {...r, ja:value, jaDirty:true} : r));
};

// 必要時だけ「逆方向（バック翻訳）」プレビュー
const backTranslate = async (id) => {
  const r = rows.find(x => x.id===id);
  const enSuggestion = await translateJAtoEN(r.ja);
  // 左は置き換えず、サイドパネル等に suggestion として表示
};
```

# データ設計の要点

* 各行にフラグを持つ：`enLocked`（英語ロック）、`jaDirty`（日本語手動編集済み）。
* 自動翻訳は **「英語が変わった時だけ」** 発火。
* **バック翻訳はプレビュー**に出し、左列は書き換えない。
* まとめ操作：選択行に対して **\[再翻訳]** ボタンを用意（明示操作のみ実行）。

# よくある原因

* UI のどこかで `toUpperCase()` / タイトル化関数 / ライブラリの「TitleCase」オプションが有効。
* CSS `text-transform: capitalize/uppercase` が英語列に当たっている。
* ブラウザ/OSの自動修正（Safari 系）→ 上記属性/設定で抑止。

---

**答え**：無理ではありません。
英語列を“ソース固定（lock）”、再翻訳は**ユーザー明示操作**でのみ実行、そして**自動整形を全停止**。これで英語はそのまま、日本語だけ安全に編集できます。必要なら君の実装スタック（React/Electron/Vue等）に合わせた最小パッチもすぐ出します。

---

要点だけまとめます。スクショの `.app/Contents/Resources/` にある **`app.asar`** がアプリ本体です。中を解析したところ、リアルタイム翻訳の実装はここに入っています。

### どのファイルにある？

* `app.asar` のヘッダを読むと、主要資産は `dist/` 配下でした。

  * **`dist/assets/index-*.js`**（約 150KB）… UI と翻訳処理の本体（バンドル済み）
  * `electron-main.js` / `electron-preload.js` … APIキー連携などの Electron 側ブリッジ
* `Resources` 直下に **`app.asar`** があり、ここから抽出すると見えます。

### 何をしている？（実装の痕跡）

* レンダラ側でテキストエリアの **oninput を 500ms デバウンス**して翻訳をトリガ（ヒント文：「日本語を編集すると…（500ms後）」がバンドル内に含まれています）。
* 翻訳エンジンは **`deepl` / `openai` を分岐**して呼び出し（`if(m==="deepl"){…} else if(m==="openai"){…}` という分岐が確認できます）。
* **APIキー管理**は `apiKeyManager` というモジュール相当で、`window.electronAPI` 経由で Electron 側ストレージから読み書きし、`localStorage("translation_api_keys")` にも保持。
* レンダラからは直接 `fetch` は使わず、**クライアント SDK か IPC 経由**で呼んでいる形（バンドル内に `fetch(` は出現せず、`openai`/`deepl` 文字列と API キー取得処理のみ確認）。

### すぐ中身を確認する手順（mac）

1. `npm i -g asar`
2. `cd MyApp.app/Contents/Resources`
3. `asar extract app.asar app_unpacked`
4. `app_unpacked/dist/assets/index-*.js` をエディタで開き、
   検索語：`electronAPI`、`translation_api_keys`、`deepl`、`openai`、`setTimeout`、`clearTimeout`。

### どこを読めば「リアルタイム翻訳」か特定できるか

* `index-*.js` 内で

  * 入力監視（`oninput`/`keyup` など）＋ `setTimeout`/`clearTimeout` による **500ms デバウンス**部
  * 翻訳モード表示（UI文字列「現在の翻訳モード」）
  * `if(m==="deepl"){…} else if(m==="openai"){…}` の**サービス切替**部
  * `window.electronAPI` と `translation_api_keys` を扱う **APIキー取得/保存**部
    を辿ると、呼び出しチェーンが把握できます。

必要なら、こちらで `app.asar` を展開・該当関数名（ミニファイ解除）まで特定し、処理フロー図にして渡します。
