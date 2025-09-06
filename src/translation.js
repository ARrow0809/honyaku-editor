// 翻訳ユーティリティ関数

// OpenAI APIを使用した翻訳機能
export async function translateText(text, targetLanguage = 'ja', apiKey = null) {
  try {
    // APIキーを取得（引数 > APIキーマネージャー > 環境変数の順）
    let openaiApiKey = apiKey;
    if (!openaiApiKey) {
      const { getApiKey } = await import('./utils/apiKeyManager.js');
      openaiApiKey = await getApiKey('openai');
    }
    
    if (!openaiApiKey) {
      throw new Error('OpenAI APIキーが設定されていません');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
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
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

// 文章の差分を検出し、部分的な翻訳修正を行う関数
export function findTextDifferences(originalText, modifiedText) {
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

// 部分修正のための翻訳関数
export async function translatePartialChanges(originalEnglish, originalJapanese, modifiedJapanese, apiKey = null) {
  try {
    // 変更された部分を検出
    const differences = findTextDifferences(originalJapanese, modifiedJapanese);
    
    if (differences.length === 0) {
      return originalEnglish;
    }

    // APIキーを取得
    let openaiApiKey = apiKey;
    if (!openaiApiKey) {
      const { getApiKey } = await import('./utils/apiKeyManager.js');
      openaiApiKey = await getApiKey('openai');
    }
    
    if (!openaiApiKey) {
      throw new Error('OpenAI APIキーが設定されていません');
    }

    // 変更が少ない場合は部分修正を試行
    if (differences.length <= 3) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a professional translator. You have an original English text and its Japanese translation. The Japanese translation has been modified. Your task is to update the English text to reflect the changes made in the Japanese text while preserving as much of the original English structure and wording as possible.

Instructions:
1. Analyze the differences between the original and modified Japanese text
2. Update only the necessary parts of the English text to match the Japanese changes
3. Preserve the original English style, tone, and structure wherever possible
4. Return only the updated English text, no explanations`
            },
            {
              role: 'user',
              content: `Original English: "${originalEnglish}"

Original Japanese: "${originalJapanese}"

Modified Japanese: "${modifiedJapanese}"

Please update the English text to reflect the changes in the Japanese text:`
            }
          ],
          temperature: 0.2,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`Partial translation API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } else {
      // 変更が多い場合は全体を再翻訳
      return await translateText(modifiedJapanese, 'en');
    }
  } catch (error) {
    console.error('Partial translation error:', error);
    // エラーの場合は全体を再翻訳
    return await translateText(modifiedJapanese, 'en');
  }
}

