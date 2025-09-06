const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

// セキュアなローカルストレージの実装
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.json');

// 設定ファイルの読み込み
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
  return {};
}

// 設定ファイルの保存
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save config:', error);
    return false;
  }
}

// IPC handlers for secure storage
ipcMain.handle('storage-get', (event, key) => {
  const config = loadConfig();
  return config[key] || null;
});

ipcMain.handle('storage-set', (event, key, value) => {
  const config = loadConfig();
  config[key] = value;
  return saveConfig(config);
});

ipcMain.handle('storage-remove', (event, key) => {
  const config = loadConfig();
  delete config[key];
  return saveConfig(config);
});

// 翻訳API処理をメインプロセスで実行
ipcMain.handle('translate-text', async (event, { text, targetLanguage, service, apiKey }) => {
  try {
    if (service === 'openai') {
      return await translateWithOpenAI(text, targetLanguage, apiKey);
    } else if (service === 'deepl') {
      return await translateWithDeepL(text, targetLanguage, apiKey);
    } else {
      throw new Error('無効な翻訳サービスです。OpenAIまたはDeepLのAPIキーを設定してください。');
    }
  } catch (error) {
    throw new Error(error.message);
  }
});

// OpenAI翻訳（メインプロセス）
async function translateWithOpenAI(text, targetLanguage, apiKey) {
  const fetch = require('electron').net.request || require('https').request;
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
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
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = require('https').request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.choices && response.choices[0]) {
            resolve(response.choices[0].message.content.trim());
          } else {
            reject(new Error('Invalid response from OpenAI'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// DeepL翻訳（メインプロセス）
async function translateWithDeepL(text, targetLanguage, apiKey) {
  const querystring = require('querystring');
  
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      text: text,
      target_lang: targetLanguage,
      source_lang: targetLanguage === 'JA' ? 'EN' : 'JA'
    });

    const options = {
      hostname: 'api-free.deepl.com',
      port: 443,
      path: '/v2/translate',
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = require('https').request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.translations && response.translations[0]) {
            resolve(response.translations[0].text);
          } else {
            reject(new Error('Invalid response from DeepL'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}


function createWindow() {
  // メインウィンドウを作成
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      preload: path.join(__dirname, 'electron-preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'), // アイコンファイルがある場合
    titleBarStyle: 'default',
    show: false // 初期状態では非表示
  });

  // ウィンドウが準備できたら表示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 開発環境では開発サーバー、本番環境では静的ファイルを読み込み
  if (isDev) {
    // 開発環境: Vite開発サーバーに接続
    setTimeout(async () => {
      try {
        console.log('Loading development server: http://localhost:5173');
        await mainWindow.loadURL('http://localhost:5173');
      } catch (error) {
        console.error('Failed to load development server:', error);
      }
    }, 3000);
  } else {
    // 本番環境: 静的ファイルを直接読み込み
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    console.log(`Loading static file: ${indexPath}`);
    
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error('Static files not found. Please run "npm run build" first.');
      mainWindow.loadURL('data:text/html,<h1>Error: Static files not found</h1><p>Please run "npm run build" first.</p>');
    }
  }

  // 外部リンクはデフォルトブラウザで開く
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 開発環境では開発者ツールを開く
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// アプリケーションの準備ができたらウィンドウを作成
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// すべてのウィンドウが閉じられたらアプリを終了
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// セキュリティ: 新しいウィンドウの作成を制限
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent, navigationURL) => {
    event.preventDefault();
    shell.openExternal(navigationURL);
  });
});