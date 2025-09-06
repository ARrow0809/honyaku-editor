// Electron IPC経由での翻訳機能

// メインプロセスの翻訳機能を呼び出す
export async function translateText(text, targetLanguage = 'ja', apiKey = null) {
  try {
    // APIキーを取得
    let translationApiKey = apiKey;
    if (!translationApiKey) {
      const { getApiKey } = await import('./utils/apiKeyManager.js');
      translationApiKey = await getApiKey('openai');
    }
    
    if (!translationApiKey) {
      throw new Error('OpenAI APIキーが設定されていません');
    }

    // Electron IPCを使用してメインプロセスで翻訳実行
    if (window.electronAPI) {
      return await window.electronAPI.translateText({
        text,
        targetLanguage,
        service: 'openai',
        apiKey: translationApiKey
      });
    } else {
      // フォールバック: 直接API呼び出し（開発環境用）
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${translationApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: targetLanguage === 'ja' 
                ? 'You are a professional translator. Translate the given English text to natural Japanese. Only return the translation, no explanations.'
                : 'You are a professional translator. Translate the given Japanese text to natural English. Only return the translation, no explanations.'
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    }
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

// DeepL翻訳
export async function translateWithDeepL(text, targetLanguage = 'JA', apiKey) {
  try {
    if (!apiKey) {
      const { getApiKey } = await import('./utils/apiKeyManager.js');
      apiKey = await getApiKey('deepl');
    }
    
    if (!apiKey) {
      throw new Error('DeepL APIキーが設定されていません');
    }

    // Electron IPCを使用してメインプロセスで翻訳実行
    if (window.electronAPI) {
      return await window.electronAPI.translateText({
        text,
        targetLanguage,
        service: 'deepl',
        apiKey
      });
    } else {
      // フォールバック: 直接API呼び出し（開発環境用）
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
    }
  } catch (error) {
    console.error('DeepL translation error:', error);
    throw error;
  }
}

// デモ翻訳
export async function demoTranslateText(text, targetLanguage = 'ja') {
  try {
    // Electron IPCを使用してメインプロセスで翻訳実行
    if (window.electronAPI) {
      return await window.electronAPI.translateText({
        text,
        targetLanguage,
        service: 'demo',
        apiKey: null
      });
    } else {
      // フォールバック: ローカルデモ翻訳
      const demoTranslations = {
        'Hello': 'こんにちは',
        'Good morning': 'おはようございます',
        'Thank you': 'ありがとうございます',
        'How are you?': '元気ですか？',
        'I am fine': '元気です',
        'こんにちは': 'Hello',
        'おはようございます': 'Good morning',
        'ありがとうございます': 'Thank you',
        '元気ですか？': 'How are you?',
        '元気です': 'I am fine'
      };

      return demoTranslations[text] || `[デモ翻訳] ${text}`;
    }
  } catch (error) {
    console.error('Demo translation error:', error);
    throw error;
  }
}

// 部分修正翻訳（OpenAI）
export async function translatePartialChanges(originalEnglish, originalJapanese, modifiedJapanese, apiKey = null) {
  try {
    // 変更が少ない場合は全体翻訳で代用（簡略化）
    return await translateText(modifiedJapanese, 'en', apiKey);
  } catch (error) {
    console.error('Partial translation error:', error);
    throw error;
  }
}

// 部分修正翻訳（DeepL）
export async function translatePartialChangesWithDeepL(originalEnglish, originalJapanese, modifiedJapanese, apiKey) {
  try {
    // 変更が少ない場合は全体翻訳で代用（簡略化）
    return await translateWithDeepL(modifiedJapanese, 'EN', apiKey);
  } catch (error) {
    console.error('DeepL partial translation error:', error);
    throw error;
  }
}

// デモ部分修正翻訳
export async function demoTranslatePartialChanges(originalEnglish, originalJapanese, modifiedJapanese) {
  try {
    // 変更が少ない場合は全体翻訳で代用（簡略化）
    return await demoTranslateText(modifiedJapanese, 'en');
  } catch (error) {
    console.error('Demo partial translation error:', error);
    throw error;
  }
}