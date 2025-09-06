// APIキー管理ユーティリティ

class ApiKeyManager {
  constructor() {
    this.keys = new Map();
    this.loadKeysFromStorage();
  }

  // ローカルストレージからAPIキーを読み込み
  loadKeysFromStorage() {
    try {
      const stored = localStorage.getItem('translation_api_keys');
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([key, value]) => {
          this.keys.set(key, value);
        });
      }
    } catch (error) {
      console.warn('Failed to load API keys from storage:', error);
    }
  }

  // APIキーをローカルストレージに保存
  saveKeysToStorage() {
    try {
      const keysObject = Object.fromEntries(this.keys);
      localStorage.setItem('translation_api_keys', JSON.stringify(keysObject));
    } catch (error) {
      console.error('Failed to save API keys to storage:', error);
    }
  }

  // APIキーを設定
  async setApiKey(service, key) {
    if (!key || key.trim() === '') {
      this.keys.delete(service);
      // Electronストレージからも削除
      if (window.electronAPI) {
        try {
          await window.electronAPI.storage.remove(`${service}_api_key`);
        } catch (error) {
          console.warn('Failed to remove API key from Electron storage:', error);
        }
      }
    } else {
      const trimmedKey = key.trim();
      this.keys.set(service, trimmedKey);
      
      // Electronの場合はセキュアストレージに保存
      if (window.electronAPI) {
        try {
          await window.electronAPI.storage.set(`${service}_api_key`, trimmedKey);
        } catch (error) {
          console.warn('Failed to save API key to Electron storage:', error);
        }
      }
    }
    this.saveKeysToStorage();
  }

  // APIキーを取得（優先順位: ローカルストレージ > 環境変数）
  async getApiKey(service) {
    // ローカルストレージから取得
    const storedKey = this.keys.get(service);
    if (storedKey) {
      return storedKey;
    }

    // Electronの場合はセキュアストレージから取得
    if (window.electronAPI) {
      try {
        const electronStoredKey = await window.electronAPI.storage.get(`${service}_api_key`);
        if (electronStoredKey) {
          this.keys.set(service, electronStoredKey);
          return electronStoredKey;
        }
      } catch (error) {
        console.warn('Failed to get API key from Electron storage:', error);
      }
    }

    // 環境変数から取得
    const envKeyMap = {
      'openai': 'VITE_OPENAI_API_KEY',
      'deepl': 'VITE_DEEPL_API_KEY'
    };

    const envKey = envKeyMap[service];
    if (envKey) {
      // Electronの場合は安全な環境変数取得を使用
      if (window.electronAPI) {
        return window.electronAPI.getEnvApiKey(envKey);
      }
      return import.meta.env[envKey] || process.env[envKey] || null;
    }

    return null;
  }

  // APIキーが設定されているかチェック
  hasApiKey(service) {
    return !!this.getApiKey(service);
  }

  // 全てのAPIキーをクリア
  clearAllKeys() {
    this.keys.clear();
    localStorage.removeItem('translation_api_keys');
  }

  // 設定されているサービス一覧を取得
  getConfiguredServices() {
    const services = [];
    
    if (this.hasApiKey('openai')) {
      services.push('openai');
    }
    
    if (this.hasApiKey('deepl')) {
      services.push('deepl');
    }
    
    // デモモードは常に利用可能
    services.push('demo');
    
    return services;
  }
}

// シングルトンインスタンス
export const apiKeyManager = new ApiKeyManager();

// 便利な関数をエクスポート
export const getApiKey = (service) => apiKeyManager.getApiKey(service);
export const setApiKey = (service, key) => apiKeyManager.setApiKey(service, key);
export const hasApiKey = (service) => apiKeyManager.hasApiKey(service);
export const getConfiguredServices = () => apiKeyManager.getConfiguredServices();