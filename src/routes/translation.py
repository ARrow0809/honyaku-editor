from flask import Blueprint, request, jsonify
import requests
import os

translation_bp = Blueprint('translation', __name__)

@translation_bp.route('/translate', methods=['POST'])
def translate():
    try:
        data = request.get_json()
        text = data.get('text')
        target_lang = data.get('target_lang', 'JA')
        source_lang = data.get('source_lang')
        api_key = data.get('api_key')
        
        if not text:
            return jsonify({'error': 'テキストが指定されていません'}), 400
        
        if not api_key:
            return jsonify({'error': 'DeepL APIキーが指定されていません'}), 400
        
        # DeepL APIに翻訳リクエストを送信
        deepl_url = 'https://api-free.deepl.com/v2/translate'
        
        headers = {
            'Authorization': f'DeepL-Auth-Key {api_key}',
            'Content-Type': 'application/x-www-form-urlencoded',
        }
        
        payload = {
            'text': text,
            'target_lang': target_lang
        }
        
        if source_lang:
            payload['source_lang'] = source_lang
        
        response = requests.post(deepl_url, headers=headers, data=payload)
        
        if response.status_code == 200:
            result = response.json()
            translated_text = result['translations'][0]['text']
            return jsonify({
                'translated_text': translated_text,
                'source_lang': result['translations'][0].get('detected_source_language', source_lang)
            })
        elif response.status_code == 403:
            return jsonify({'error': 'DeepL APIキーが無効です'}), 403
        elif response.status_code == 456:
            return jsonify({'error': 'DeepL APIの使用量制限に達しました'}), 456
        elif response.status_code == 429:
            return jsonify({'error': 'リクエストが多すぎます。しばらく待ってから再試行してください'}), 429
        else:
            return jsonify({'error': f'DeepL API error: {response.status_code}'}), response.status_code
            
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'リクエストエラー: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'サーバーエラー: {str(e)}'}), 500

@translation_bp.route('/translate-partial', methods=['POST'])
def translate_partial():
    try:
        data = request.get_json()
        original_english = data.get('original_english')
        original_japanese = data.get('original_japanese')
        modified_japanese = data.get('modified_japanese')
        api_key = data.get('api_key')
        
        if not all([original_english, original_japanese, modified_japanese, api_key]):
            return jsonify({'error': '必要なパラメータが不足しています'}), 400
        
        # 変更が少ない場合は部分修正を試行、多い場合は全体を再翻訳
        differences = find_text_differences(original_japanese, modified_japanese)
        
        if len(differences) == 0:
            return jsonify({'translated_text': original_english})
        
        # 変更が多い場合は全体を再翻訳
        if len(differences) > 3:
            return translate_full_text(modified_japanese, 'EN', api_key)
        
        # 部分修正のロジック
        updated_english = apply_partial_changes(original_english, original_japanese, modified_japanese)
        
        return jsonify({'translated_text': updated_english})
        
    except Exception as e:
        return jsonify({'error': f'部分修正エラー: {str(e)}'}), 500

def translate_full_text(text, target_lang, api_key):
    """完全な翻訳を実行"""
    deepl_url = 'https://api-free.deepl.com/v2/translate'
    
    headers = {
        'Authorization': f'DeepL-Auth-Key {api_key}',
        'Content-Type': 'application/x-www-form-urlencoded',
    }
    
    payload = {
        'text': text,
        'target_lang': target_lang
    }
    
    response = requests.post(deepl_url, headers=headers, data=payload)
    
    if response.status_code == 200:
        result = response.json()
        return jsonify({'translated_text': result['translations'][0]['text']})
    else:
        raise Exception(f'DeepL API error: {response.status_code}')

def find_text_differences(original_text, modified_text):
    """文章の差分を検出"""
    original_words = original_text.split()
    modified_words = modified_text.split()
    
    differences = []
    max_length = max(len(original_words), len(modified_words))
    
    for i in range(max_length):
        original = original_words[i] if i < len(original_words) else ''
        modified = modified_words[i] if i < len(modified_words) else ''
        
        if original != modified:
            differences.append({
                'index': i,
                'original': original,
                'modified': modified,
                'type': 'added' if original == '' else 'removed' if modified == '' else 'changed'
            })
    
    return differences

def apply_partial_changes(original_english, original_japanese, modified_japanese):
    """部分修正を適用"""
    updated_english = original_english
    
    # 年齢の変更を検出
    import re
    age_match = re.search(r'(\d+)歳', modified_japanese)
    original_age_match = re.search(r'(\d+)歳', original_japanese)
    
    if age_match and original_age_match and age_match.group(1) != original_age_match.group(1):
        updated_english = re.sub(
            rf'{original_age_match.group(1)} years old',
            f'{age_match.group(1)} years old',
            updated_english
        )
    
    # 名前の変更を検出
    name_changes = {
        'ジョン': 'John',
        'マイク': 'Mike',
        'サラ': 'Sarah',
        'トム': 'Tom',
        'エミリー': 'Emily',
        'デイビッド': 'David'
    }
    
    for japanese_name, english_name in name_changes.items():
        if japanese_name in modified_japanese and japanese_name not in original_japanese:
            # 新しい名前に変更
            for orig_ja, orig_en in name_changes.items():
                if orig_ja in original_japanese:
                    updated_english = updated_english.replace(orig_en, english_name)
                    break
    
    # 場所の変更を検出
    location_changes = {
        '東京': 'Tokyo',
        '大阪': 'Osaka',
        '京都': 'Kyoto',
        '名古屋': 'Nagoya',
        '横浜': 'Yokohama',
        '神戸': 'Kobe'
    }
    
    for japanese_location, english_location in location_changes.items():
        if japanese_location in modified_japanese and japanese_location not in original_japanese:
            for orig_ja, orig_en in location_changes.items():
                if orig_ja in original_japanese:
                    updated_english = updated_english.replace(orig_en, english_location)
                    break
    
    return updated_english

