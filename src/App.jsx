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
  const [lastEdited, setLastEdited] = useState(null) // 'en' | 'ja'

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
    // 日本語編集 → 左の英語を自動更新（500msデバウンス）
    setLastEdited('ja')
    setJapaneseText(newJapaneseText)

    // 空なら英語側もクリア
    if (!newJapaneseText.trim()) {
      setEnglishText('')
      setOriginalJapanese('')
      return
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(async () => {
      setIsTranslating(true)
      setError('')
      try {
        // 書式保護: 行頭トークンのケースを前の英語に合わせて保存（箇条書き/見出し/番号付き対応、コードブロックは無視）
        const isCodeFence = (line) => line.trim().startsWith('```')
        const firstWordAfterMarkers = (line) => {
          // マーカー: *, -, •, 数字. / 数字) / # 見出し
          const m = line.match(/^\s*(?:[*•\-]\s+|\d+[\.)]\s+|#+\s+)?(.+?)$/)
          const rest = m ? m[1] : line
          const m2 = rest.match(/([A-Za-z][A-Za-z0-9_\-]*)/)
          return m2 ? { token: m2[1], index: (m ? m[0].length - m2[0].length : rest.indexOf(m2[1])) + (line.length - rest.length) } : null
        }
        const caseStyleOf = (word) => {
          if (!word) return 'asIs'
          if (word.toUpperCase() === word) return 'upper'
          if (word.toLowerCase() === word) return 'lower'
          if (/^[A-Z][a-z0-9\-_]*$/.test(word)) return 'capitalized'
          return 'asIs'
        }
        const applyStyle = (style, word) => {
          if (!word) return word
          switch (style) {
            case 'upper': return word.toUpperCase()
            case 'lower': return word.toLowerCase()
            case 'capitalized': return word[0].toUpperCase() + word.slice(1).toLowerCase()
            default: return word
          }
        }
        const preserveFirstTokenCase = (prevLine, nextLine) => {
          if (!prevLine || !nextLine) return nextLine
          // コードブロック行は変更しない
          if (isCodeFence(prevLine) || isCodeFence(nextLine) || prevLine.trim().startsWith('`') || nextLine.trim().startsWith('`')) {
            return nextLine
          }
          const prev = firstWordAfterMarkers(prevLine)
          const next = firstWordAfterMarkers(nextLine)
          if (!prev || !next) return nextLine
          if (prev.token.toLowerCase() !== next.token.toLowerCase()) return nextLine
          const style = caseStyleOf(prev.token)
          const styled = applyStyle(style, next.token)
          if (styled === next.token) return nextLine
          // 置換（最初に見つかった同一トークン位置を安全に置換）
          const before = nextLine.slice(0, next.index)
          const afterStart = next.index + next.token.length
          const after = nextLine.slice(afterStart)
          return before + styled + after
        }
        const applyPreserveTokenCase = (prevText, nextText) => {
          const prevLines = (prevText || '').split(/\r?\n/)
          const nextLines = (nextText || '').split(/\r?\n/)
          let inFence = false
          const out = []
          const max = Math.max(prevLines.length, nextLines.length)
          for (let i = 0; i < max; i++) {
            const p = prevLines[i] || ''
            let n = nextLines[i] || ''
            const toggle = (s) => isCodeFence(s)
            if (toggle(p)) inFence = !inFence
            if (!inFence) {
              n = preserveFirstTokenCase(p, n)
            }
            if (toggle(n)) inFence = !inFence
            out.push(n)
          }
          return out.join('\n')
        }
        // 最小限の変換: 行数が同じで変更行が少数なら、その行だけ翻訳して差し替え
        const prevJ = (originalJapanese || '')
        const prevE = (englishText || '')
        const prevJLines = prevJ.split(/\r?\n/)
        const prevELines = prevE.split(/\r?\n/)
        const newJLines = newJapaneseText.split(/\r?\n/)
        const canPartial = prevJ && prevE && prevJLines.length === newJLines.length

        const translateLine = async (ja) => {
          if (translationMode === 'deepl') {
            const deeplApiKey = await apiKeyManager.getApiKey('deepl')
            if (!deeplApiKey) {
              setError('DeepL APIキーが設定されていません。設定画面で入力してください。')
              return null
            }
            return await translateWithDeepL(ja, 'EN', deeplApiKey)
          } else {
            return await translateText(ja, 'en')
          }
        }

        let nextEnglish = ''
        if (canPartial) {
          const changedIdx = []
          for (let i = 0; i < newJLines.length; i++) {
            if (newJLines[i] !== prevJLines[i]) changedIdx.push(i)
          }
          if (changedIdx.length > 0 && changedIdx.length <= 3) {
            const newELines = [...prevELines]
            const parts = await Promise.all(changedIdx.map(i => translateLine(newJLines[i])))
            for (let k = 0; k < changedIdx.length; k++) {
              const i = changedIdx[k]
              const t = parts[k] ?? ''
              newELines[i] = preserveFirstTokenCase(prevELines[i] || '', (t || ''))
            }
            nextEnglish = newELines.join('\n')
          }
        }

        if (!nextEnglish) {
          // 全体更新（トークンのケースは前回英語に合わせて保護）
          let full
          if (translationMode === 'deepl') {
            const deeplApiKey = await apiKeyManager.getApiKey('deepl')
            if (!deeplApiKey) {
              setError('DeepL APIキーが設定されていません。設定画面で入力してください。')
              return
            }
            full = await translateWithDeepL(newJapaneseText, 'EN', deeplApiKey)
          } else {
            full = await translateText(newJapaneseText, 'en')
          }
          nextEnglish = applyPreserveTokenCase(prevE, full || '')
        }

        setEnglishText(nextEnglish)
        setOriginalJapanese(newJapaneseText)
      } catch (error) {
        console.error('Translation error:', error)
        setError(error.message || '翻訳に失敗しました。')
      } finally {
        setIsTranslating(false)
      }
    }, 500)
  }

  // 英語入力のリアルタイム翻訳（英→日）
  useEffect(() => {
    // 直近の入力が英語のときだけ、右を自動更新
    if (lastEdited !== 'en') return
    // 空文字なら右側もクリア
    if (!englishText.trim()) {
      setJapaneseText('')
      setOriginalJapanese('')
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
        let translated
        if (translationMode === 'deepl') {
          const deeplApiKey = await apiKeyManager.getApiKey('deepl')
          if (!deeplApiKey) {
            setError('DeepL APIキーが設定されていません。設定画面で入力してください。')
            return
          }
          translated = await translateWithDeepL(englishText, 'JA', deeplApiKey)
        } else {
          translated = await translateText(englishText, 'ja')
        }
        setJapaneseText(translated)
        setOriginalJapanese(translated)
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
  }, [englishText, translationMode, lastEdited])

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
                onInput={(e) => { setLastEdited('en'); setEnglishText(e.target.value) }}
                placeholder="英語のテキストを入力してください..."
                className="min-h-[300px] resize-none"
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
