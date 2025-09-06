// バックエンドAPI経由の翻訳ユーティリティ関数

// バックエンドAPI経由でDeepL翻訳を実行
export async function translateWithBackend(text, targetLanguage = 'JA', apiKey) {
  if (!apiKey) {
    throw new Error('DeepL APIキーが設定されていません');
  }

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        target_lang: targetLanguage,
        source_lang: targetLanguage === 'JA' ? 'EN' : 'JA',
        api_key: apiKey
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.translated_text;
  } catch (error) {
    console.error('Backend translation error:', error);
    throw error;
  }
}

// バックエンドAPI経由で部分修正翻訳を実行
export async function translatePartialChangesWithBackend(originalEnglish, originalJapanese, modifiedJapanese, apiKey) {
  if (!apiKey) {
    throw new Error('DeepL APIキーが設定されていません');
  }

  try {
    const response = await fetch('/api/translate-partial', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        original_english: originalEnglish,
        original_japanese: originalJapanese,
        modified_japanese: modifiedJapanese,
        api_key: apiKey
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.translated_text;
  } catch (error) {
    console.error('Backend partial translation error:', error);
    throw error;
  }
}

