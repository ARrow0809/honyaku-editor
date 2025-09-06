// デモ用翻訳機能（実際のAPIを使用しない）

// 簡単な英日翻訳辞書
const englishToJapanese = {
  'hello': 'こんにちは',
  'my': '私の',
  'name': '名前',
  'is': 'は',
  'john': 'ジョン',
  'i': '私',
  'am': 'です',
  'years': '歳',
  'old': '',
  'and': 'そして',
  'love': '愛している',
  'programming': 'プログラミング',
  'work': '働いている',
  'as': 'として',
  'a': '',
  'software': 'ソフトウェア',
  'engineer': 'エンジニア',
  'at': 'で',
  'tech': '技術',
  'company': '会社',
  'in': 'の',
  'tokyo': '東京',
  '20': '20',
  '30': '30'
};

// 簡単な日英翻訳辞書
const japaneseToEnglish = {
  'こんにちは': 'hello',
  '私の': 'my',
  '名前': 'name',
  'は': 'is',
  'ジョン': 'john',
  '私': 'i',
  'です': 'am',
  '歳': 'years old',
  'そして': 'and',
  '愛している': 'love',
  'プログラミング': 'programming',
  'を': '',
  '働いている': 'work',
  'として': 'as',
  'ソフトウェア': 'software',
  'エンジニア': 'engineer',
  'で': 'at',
  '技術': 'tech',
  '会社': 'company',
  'の': 'in',
  '東京': 'tokyo',
  '20': '20',
  '30': '30'
};

// デモ用翻訳関数
export function demoTranslateText(text, targetLanguage = 'ja') {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (targetLanguage === 'ja') {
        // 英語から日本語
        if (text.toLowerCase().includes('hello, my name is john')) {
          resolve('こんにちは、私の名前はジョンです。私は20歳でプログラミングを愛しています。東京の技術会社でソフトウェアエンジニアとして働いています。');
        } else {
          // 簡単な単語置換
          let translated = text.toLowerCase();
          Object.entries(englishToJapanese).forEach(([en, ja]) => {
            translated = translated.replace(new RegExp(en, 'g'), ja);
          });
          resolve(translated);
        }
      } else {
        // 日本語から英語
        if (text.includes('こんにちは、私の名前はジョンです')) {
          resolve('Hello, my name is John. I am 30 years old and I love programming. I work as a software engineer at a tech company in Tokyo.');
        } else {
          // 簡単な単語置換
          let translated = text;
          Object.entries(japaneseToEnglish).forEach(([ja, en]) => {
            translated = translated.replace(new RegExp(ja, 'g'), en);
          });
          resolve(translated);
        }
      }
    }, 1000); // 1秒の遅延でAPIコールをシミュレート
  });
}

// 部分修正のデモ関数
export function demoTranslatePartialChanges(originalEnglish, originalJapanese, modifiedJapanese) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // 20歳 → 30歳の変更を検出
      if (originalJapanese.includes('20歳') && modifiedJapanese.includes('30歳')) {
        const updatedEnglish = originalEnglish.replace('20 years old', '30 years old');
        resolve(updatedEnglish);
      }
      // その他の変更パターン
      else if (originalJapanese.includes('ジョン') && modifiedJapanese.includes('マイク')) {
        const updatedEnglish = originalEnglish.replace('John', 'Mike');
        resolve(updatedEnglish);
      }
      // プログラミング → デザインの変更
      else if (originalJapanese.includes('プログラミング') && modifiedJapanese.includes('デザイン')) {
        const updatedEnglish = originalEnglish.replace('programming', 'design');
        resolve(updatedEnglish);
      }
      // 東京 → 大阪の変更
      else if (originalJapanese.includes('東京') && modifiedJapanese.includes('大阪')) {
        const updatedEnglish = originalEnglish.replace('Tokyo', 'Osaka');
        resolve(updatedEnglish);
      }
      // デフォルトは全体を再翻訳
      else {
        demoTranslateText(modifiedJapanese, 'en').then(resolve);
      }
    }, 800);
  });
}

