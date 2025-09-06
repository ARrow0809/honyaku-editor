import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from './components/ui/button.jsx'
import { Textarea } from './components/ui/textarea.jsx'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card.jsx'
import { Input } from './components/ui/input.jsx'
import { Label } from './components/ui/label.jsx'
import { 
  translateText, 
  translatePartialChanges,
  translateWithDeepL,
  translatePartialChangesWithDeepL,
  demoTranslateText,
  demoTranslatePartialChanges
} from './electronTranslation.js'
import ApiKeySettings from './components/ApiKeySettings.jsx'
import { apiKeyManager } from './utils/apiKeyManager.js'
import './App.css'

function App() {
  const [englishText, setEnglishText] = useState('')
  const [japaneseText, setJapaneseText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState('')
  const [originalJapanese, setOriginalJapanese] = useState('')
  const [translationMode, setTranslationMode] = useState('deepl') // 'openai', 'deepl'
  const [showSettings, setShowSettings] = useState(false)
  const debounceTimer = useRef(null)
  const englishDebounceTimer = useRef(null)
  // 最小変換用の保持
  const lastCommittedEN = useRef('')
  const lastENLines = useRef([])
  const lastJALines = useRef([])

  const translateToJapanese = async () => {
    if (!englishText.trim()) return
    
    setIsTranslating(true)
    setError('')
    
    try {
      let translated;
      
      if (translationMode === 'deepl') {
        const deeplApiKey = await apiKeyManager.getApiKey('deepl');
        if (!deeplApiKey) {
          throw new Error('DeepL APIキーが設定されていません。設定画面で入力してください。');
        }
        translated = await translateWithDeepL(englishText, 'JA', deeplApiKey);
      } else if (translationMode === 'openai') {
        translated = await translateText(englishText, 'ja');
      }
      
      setJapaneseText(translated)
      setOriginalJapanese(translated)
    } catch (error) {
      console.error('Translation error:', error)
      setError(error.message || '翻訳に失敗しました。')
    } finally {
      setIsTranslating(false)
    }
  }

  const updateEnglishFromJapanese = (newJapaneseText) => {
    // AGENT.md準拠: 日本語の編集は英語に波及しない（翻訳は発火させない）
    setJapaneseText(newJapaneseText)
    // 行数が一致する場合は lastJALines も同期（内部表示用）
    const cur = newJapaneseText.split(/\r?\n/)
    if (cur.length === lastJALines.current.length) {
      lastJALines.current = cur
    }
  }

  // 英語入力のリアルタイム翻訳（英→日）
  useEffect(() => {
    // 空文字なら右側もクリア
    if (!englishText.trim()) {
      setJapaneseText('')
      setOriginalJapanese('')
      lastCommittedEN.current = ''
      lastENLines.current = []
      lastJALines.current = []
      return
    }

    // デバウンス 500ms
    if (englishDebounceTimer.current) {
      clearTimeout(englishDebounceTimer.current)
    }

    englishDebounceTimer.current = setTimeout(async () => {
      setIsTranslating(true)
      setError('')
      try {
        // AGENT.md準拠: 変換を最小限に（英→日のみ、行単位差分）
        const nowEN = englishText
        const nowENLines = nowEN.split(/\r?\n/)
        const prevENLines = lastENLines.current
        const prevJALines = lastJALines.current

        const normalize = (s) => s.replace(/\s+/g, ' ').trim()
        const map = new Map((prevENLines || []).map((l, i) => [normalize(l), i]))
        const outJA = []

        const translateLine = async (en) => {
          if (!en.trim()) return ''
          if (translationMode === 'deepl') {
            const deeplApiKey = await apiKeyManager.getApiKey('deepl')
            if (!deeplApiKey) {
              setError('DeepL APIキーが設定されていません。設定画面で入力してください。')
              return ''
            }
            return await translateWithDeepL(en, 'JA', deeplApiKey)
          } else {
            return await translateText(en, 'ja')
          }
        }

        for (const line of nowENLines) {
          // 区切り線はそのまま
          if (/^\s*---\s*$/.test(line)) {
            outJA.push('---')
            continue
          }
          // 箇条書きはマーカー保持
          const m = line.match(/^(\s*[*-]\s*)(.*)$/)
          const bullet = m ? m[1] : ''
          const body = m ? m[2] : line

          const key = normalize(line)
          const prevIdx = map.get(key)
          if (prevIdx !== undefined && prevJALines[prevIdx] !== undefined) {
            outJA.push(prevJALines[prevIdx])
          } else if (!body.trim()) {
            outJA.push(bullet)
          } else {
            const jaLine = await translateLine(body)
            outJA.push(bullet + jaLine)
          }
        }

        // 状態更新（確定）
        lastCommittedEN.current = nowEN
        lastENLines.current = nowENLines
        lastJALines.current = outJA
        const jaJoined = outJA.join('\n')
        setJapaneseText(jaJoined)
        setOriginalJapanese(jaJoined)
      } catch (error) {
        console.error('Translation error:', error)
        setError(error.message || '翻訳に失敗しました。')
      } finally {
        setIsTranslating(false)
      }
    }, 500)

    return () => {
      if (englishDebounceTimer.current) {
        clearTimeout(englishDebounceTimer.current)
      }
    }
  }, [englishText, translationMode])

  // 更新ボタン用の関数（デバッグ用）
  const forceUpdateEnglish = () => {
    if (japaneseText.trim()) {
      updateEnglishFromJapanese(japaneseText)
    }
  }

  const clearAll = () => {
    setEnglishText('')
    setJapaneseText('')
    setOriginalJapanese('')
    setError('')
  }

  const getTranslationModeLabel = () => {
    switch (translationMode) {
      case 'deepl': return 'DeepL API'
      case 'openai': return 'OpenAI GPT-3.5'
      default: return 'OpenAI GPT-3.5'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-4xl">🌐</span>
            <h1 className="text-3xl font-bold text-gray-800">リアルタイム翻訳ツール</h1>
            <Button
              variant="outline"
              onClick={() => setShowSettings(!showSettings)}
              className="ml-4"
            >
              ⚙️ 設定
            </Button>
          </div>
          <p className="text-gray-600">
            英語を入力して日本語に翻訳し、日本語を編集すると英語がリアルタイムで修正されます
          </p>
          <p className="text-sm text-gray-500 mt-2">
            現在の翻訳モード: <span className="font-semibold">{getTranslationModeLabel()}</span>
          </p>
        </div>

        {/* 設定パネル */}
        {showSettings && (
          <ApiKeySettings 
            onClose={() => setShowSettings(false)} 
            translationMode={translationMode}
            setTranslationMode={setTranslationMode}
          />
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <span className="text-xl">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 英語入力エリア */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-blue-600">🇺🇸</span>
                英語（原文）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={englishText}
                onInput={(e) => { setEnglishText(e.target.value) }}
                placeholder="英語のテキストを入力してください..."
                className="min-h-[300px] resize-none"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
              />
              <div className="mt-4 flex justify-center gap-2">
                <Button 
                  onClick={translateToJapanese}
                  disabled={!englishText.trim() || isTranslating}
                  className="flex items-center gap-2"
                >
                  ⇄
                  {isTranslating ? '翻訳中...' : '日本語に翻訳'}
                </Button>
                <Button 
                  onClick={clearAll}
                  variant="outline"
                  disabled={isTranslating}
                >
                  クリア
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 日本語編集エリア */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-red-600">🇯🇵</span>
                日本語（編集可能）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={japaneseText}
                onInput={(e) => updateEnglishFromJapanese(e.target.value)}
                placeholder="翻訳された日本語がここに表示されます。編集すると英語が自動修正されます..."
                className="min-h-[300px] resize-none"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
              />
              {/* リアルタイム変換に統一のためヒントと強制更新ボタンを削除 */}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-2">使い方</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>1. 「⚙️ 設定」でAPIキーを設定します</p>
              <p>2. 左側に英語のテキストを入力します</p>
              <p>3. 「日本語に翻訳」ボタンをクリックして翻訳します</p>
              <p>4. 右側の日本語を編集すると、左側の英語が自動的に修正されます</p>
              <p>5. 部分的な変更は元の英語の構造を保持しながら修正されます</p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>翻訳モード:</strong> OpenAI GPT-3.5またはDeepL APIから選択できます。
              どちらも高品質な翻訳を提供します。設定画面でAPIキーを入力してください。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
