from flask import Flask, render_template, jsonify, request
import json
import os
from calculator import CostCalculator

app = Flask(__name__)

DATA_PATH = os.path.join(os.path.dirname(__file__), 'data', 'products.json')

def load_products():
    if not os.path.exists(DATA_PATH):
        return []
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_products(products):
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/products', methods=['GET'])
def get_products():
    """获取所有作品及促销记录"""
    return jsonify(load_products())

@app.route('/api/products/batch', methods=['POST'])
def update_products():
    """批量同步导入的作品数据"""
    data = request.json
    if not isinstance(data, list):
        return jsonify({"success": False, "error": "Invalid format"}), 400
    save_products(data)
    return jsonify({"success": True, "count": len(data)})

@app.route('/api/calculate', methods=['POST'])
def calculate_cost():
    """后端费用测算接口"""
    params = request.json
    result = CostCalculator.calculate(
        work=params.get('work', {}),
        event=params.get('event', {}),
        buy_episodes=params.get('buyEpisodes', 1),
        coin_to_krw=params.get('coinToKrw', 120),
        krw_to_cny=params.get('krwToCny', 5.3)
    )
    return jsonify(result)

if __name__ == '__main__':
    # 监听 0.0.0.0 支持本地与云端 Codespaces 端口转发
    app.run(host='0.0.0.0', port=5000, debug=True)
