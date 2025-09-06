#!/bin/bash

# セキュアなElectronアプリビルドスクリプト
# リアルタイム翻訳ツール用

set -e

echo "🚀 セキュアなElectronアプリのビルドを開始します..."

# 環境チェック
echo "📋 環境をチェックしています..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.jsがインストールされていません"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Python3がインストールされていません"
    exit 1
fi

# 依存関係のインストール
echo "📦 依存関係をインストールしています..."
npm ci

# Python依存関係のチェック
echo "🐍 Python依存関係をチェックしています..."
pip3 install -r requirements.txt

# 環境変数ファイルの確認
if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
    echo "⚠️  環境変数ファイルが見つかりません"
    echo "📝 .env.example を参考に .env.local ファイルを作成してください"
    echo "   または、アプリ内でAPIキーを設定できます"
fi

# セキュリティチェック
echo "🔒 セキュリティチェックを実行しています..."

# .gitignoreの確認
if ! grep -q "\.env" .gitignore; then
    echo "⚠️  .gitignoreに.envファイルが追加されていません"
    echo ".env" >> .gitignore
    echo "✅ .gitignoreを更新しました"
fi

# APIキーの漏洩チェック
if grep -r "sk-[a-zA-Z0-9]" src/ 2>/dev/null | grep -v "your_openai_api_key_here"; then
    echo "❌ ソースコードにAPIキーがハードコーディングされている可能性があります"
    echo "   セキュリティ上の理由により、ビルドを中止します"
    exit 1
fi

# フロントエンドのビルド
echo "🏗️  フロントエンドをビルドしています..."
npm run build

# Electronアプリのビルド
echo "📱 Electronアプリをビルドしています..."

# プラットフォーム別ビルド
case "$1" in
    "mac")
        echo "🍎 macOS用アプリをビルドしています..."
        npm run dist-mac
        ;;
    "win")
        echo "🪟 Windows用アプリをビルドしています..."
        npm run dist-win
        ;;
    "linux")
        echo "🐧 Linux用アプリをビルドしています..."
        npm run dist-linux
        ;;
    *)
        echo "🖥️  現在のプラットフォーム用アプリをビルドしています..."
        npm run dist
        ;;
esac

# ビルド結果の確認
echo "📊 ビルド結果を確認しています..."
if [ -d "dist-electron" ]; then
    echo "✅ ビルドが完了しました！"
    echo "📁 出力ディレクトリ: dist-electron/"
    ls -la dist-electron/
    
    # セキュリティ情報の表示
    echo ""
    echo "🔒 セキュリティ情報:"
    echo "   - APIキーはアプリ内で安全に管理されます"
    echo "   - 設定ファイルは暗号化されてローカルに保存されます"
    echo "   - 詳細は SECURITY_GUIDE.md をご確認ください"
    
    # 使用方法の表示
    echo ""
    echo "🎉 使用方法:"
    echo "   1. dist-electron/ 内のアプリを実行"
    echo "   2. 設定画面でAPIキーを入力"
    echo "   3. 翻訳機能をお楽しみください！"
else
    echo "❌ ビルドに失敗しました"
    exit 1
fi

echo "✨ ビルドプロセスが完了しました！"