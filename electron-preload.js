// Preload script for security
const { contextBridge, ipcRenderer } = require('electron');

// セキュアなAPIをレンダラープロセスに公開
contextBridge.exposeInMainWorld('electronAPI', {
  // プラットフォーム情報
  platform: process.platform,
  versions: process.versions,
  
  // 環境変数からAPIキーを安全に取得
  getEnvApiKey: (keyName) => {
    const allowedKeys = ['VITE_OPENAI_API_KEY', 'VITE_DEEPL_API_KEY'];
    if (allowedKeys.includes(keyName)) {
      return process.env[keyName] || null;
    }
    return null;
  },
  
  // ローカルストレージ操作（セキュア）
  storage: {
    get: (key) => ipcRenderer.invoke('storage-get', key),
    set: (key, value) => ipcRenderer.invoke('storage-set', key, value),
    remove: (key) => ipcRenderer.invoke('storage-remove', key)
  },
  
  // 翻訳機能（メインプロセス経由）
  translateText: (params) => ipcRenderer.invoke('translate-text', params),
  
  // アプリケーション情報
  getAppInfo: () => ({
    name: 'Realtime Translation Tool',
    version: '1.0.0',
    platform: process.platform
  })
});