# リアルタイム翻訳ツール

日本語と英語の相互翻訳を行い、リアルタイムで修正を反映できるWebアプリケーションです。

## 機能

- 日本語 ⇄ 英語の相互翻訳
- リアルタイム修正機能
- 複数の翻訳API対応:
  - OpenAI GPT-3.5-turbo
  - DeepL API
  - デモモード（APIキー不要）

## 技術スタック

### フロントエンド
- React 18
- Vite
- TailwindCSS

### バックエンド
- Python Flask
- SQLAlchemy
- Flask-CORS

## セットアップ

### 1. 依存関係のインストール

```bash
# Node.js依存関係
npm install

# Python依存関係
pip install -r requirements.txt
```

### 2. 環境変数の設定

`.env.local`ファイルを作成し、APIキーを設定してください：

```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

### 3. 開発環境での実行

#### フロントエンド（開発サーバー）
```bash
npm run dev
```

#### バックエンド
```bash
python main.py
```

### 4. 本番環境でのデプロイ

#### 方法1: 直接デプロイ
```bash
# デプロイスクリプトを実行
./deploy.sh

# アプリケーションを起動
python main.py
```

#### 方法2: Dockerを使用
```bash
# Dockerコンテナをビルド・起動
docker-compose up --build
```

## 使用方法

1. ブラウザで `http://localhost:5000` にアクセス
2. 翻訳モードを選択（OpenAI、DeepL、デモ）
3. 必要に応じてAPIキーを入力
4. 左側のテキストエリアに翻訳したいテキストを入力
5. 翻訳ボタンをクリックして翻訳を実行
6. 右側のテキストエリアで翻訳結果を編集すると、左側にリアルタイムで反映

## API設定

### OpenAI API
- OpenAIのAPIキーが必要
- GPT-3.5-turboモデルを使用

### DeepL API
- DeepLのAPIキーが必要
- 無料版・有料版両方に対応

### デモモード
- APIキー不要
- 基本的な翻訳機能のみ

## ファイル構成

```
├── src/
│   ├── App.jsx              # メインアプリケーション
│   ├── App.css              # スタイル
│   ├── main.jsx             # エントリーポイント
│   ├── translation.js       # OpenAI翻訳機能
│   ├── deeplTranslation.js  # DeepL翻訳機能
│   ├── backendTranslation.js # バックエンド翻訳機能
│   ├── demoTranslation.js   # デモ翻訳機能
│   ├── models/
│   │   └── user.py          # ユーザーモデル
│   └── routes/
│       ├── user.py          # ユーザールート
│       └── translation.py   # 翻訳ルート
├── main.py                  # Flaskアプリケーション
├── package.json             # Node.js依存関係
├── requirements.txt         # Python依存関係
├── vite.config.js          # Vite設定
├── tailwind.config.js      # TailwindCSS設定
├── Dockerfile              # Docker設定
├── docker-compose.yml      # Docker Compose設定
└── deploy.sh               # デプロイスクリプト
```

## トラブルシューティング

### ポート5000が使用中の場合
```bash
# 別のポートを使用
export PORT=8000
python main.py
```

### APIキーエラーの場合
- `.env.local`ファイルでAPIキーが正しく設定されているか確認
- APIキーの有効性を確認

### ビルドエラーの場合
```bash
# node_modulesを削除して再インストール
rm -rf node_modules
npm install
```

## ライセンス

MIT License