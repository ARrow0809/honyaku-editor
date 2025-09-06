// DeepL翻訳APIユーティリティ関数

// DeepL APIを使用した翻訳機能
export async function translateWithDeepL(text, targetLanguage = 'JA', apiKey) {
  if (!apiKey) {
    throw new Error('DeepL APIキーが設定されていません');
  }

  try {
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: text,
        target_lang: targetLanguage,
        source_lang: targetLanguage === 'JA' ? 'EN' : 'JA'
      })
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('DeepL APIキーが無効です');
      } else if (response.status === 456) {
        throw new Error('DeepL APIの使用量制限に達しました');
      } else {
        throw new Error(`DeepL API error: ${response.status}`);
      }
    }

    const data = await response.json();
    return data.translations[0].text;
  } catch (error) {
    console.error('DeepL translation error:', error);
    throw error;
  }
}

// DeepL APIを使用した部分修正翻訳
export async function translatePartialChangesWithDeepL(originalEnglish, originalJapanese, modifiedJapanese, apiKey) {
  try {
    // 変更が少ない場合は部分修正を試行
    const differences = findTextDifferences(originalJapanese, modifiedJapanese);
    
    if (differences.length === 0) {
      return originalEnglish;
    }

    // 変更が多い場合は全体を再翻訳
    if (differences.length > 3) {
      return await translateWithDeepL(modifiedJapanese, 'EN', apiKey);
    }

    // 部分修正のロジック（簡単な置換）
    let updatedEnglish = originalEnglish;
    
    // 年齢の変更を検出
    const ageMatch = modifiedJapanese.match(/(\d+)歳/);
    const originalAgeMatch = originalJapanese.match(/(\d+)歳/);
    
    if (ageMatch && originalAgeMatch && ageMatch[1] !== originalAgeMatch[1]) {
      updatedEnglish = updatedEnglish.replace(
        new RegExp(`${originalAgeMatch[1]} years old`, 'g'),
        `${ageMatch[1]} years old`
      );
    }

    // 名前の変更を検出
    const nameChanges = {
      'ジョン': 'John',
      'マイク': 'Mike',
      'サラ': 'Sarah',
      'トム': 'Tom'
    };

    Object.entries(nameChanges).forEach(([japanese, english]) => {
      if (modifiedJapanese.includes(japanese) && !originalJapanese.includes(japanese)) {
        // 新しい名前に変更
        Object.entries(nameChanges).forEach(([origJa, origEn]) => {
          if (originalJapanese.includes(origJa)) {
            updatedEnglish = updatedEnglish.replace(new RegExp(origEn, 'g'), english);
          }
        });
      }
    });

    // 場所の変更を検出
    const locationChanges = {
      '東京': 'Tokyo',
      '大阪': 'Osaka',
      '京都': 'Kyoto',
      '名古屋': 'Nagoya'
    };

    Object.entries(locationChanges).forEach(([japanese, english]) => {
      if (modifiedJapanese.includes(japanese) && !originalJapanese.includes(japanese)) {
        Object.entries(locationChanges).forEach(([origJa, origEn]) => {
          if (originalJapanese.includes(origJa)) {
            updatedEnglish = updatedEnglish.replace(new RegExp(origEn, 'g'), english);
          }
        });
      }
    });

    return updatedEnglish;
  } catch (error) {
    console.error('DeepL partial translation error:', error);
    // エラーの場合は全体を再翻訳
    return await translateWithDeepL(modifiedJapanese, 'EN', apiKey);
  }
}

// 文章の差分を検出する関数
function findTextDifferences(originalText, modifiedText) {
  const originalWords = originalText.split(/(\s+|[。、！？\n])/);
  const modifiedWords = modifiedText.split(/(\s+|[。、！？\n])/);
  
  const differences = [];
  const maxLength = Math.max(originalWords.length, modifiedWords.length);
  
  for (let i = 0; i < maxLength; i++) {
    const original = originalWords[i] || '';
    const modified = modifiedWords[i] || '';
    
    if (original !== modified) {
      differences.push({
        index: i,
        original: original,
        modified: modified,
        type: original === '' ? 'added' : modified === '' ? 'removed' : 'changed'
      });
    }
  }
  
  return differences;
}

