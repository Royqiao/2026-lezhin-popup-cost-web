@echo off
chcp 65001 >nul
echo 正在检查并安装 Python 依赖...
pip install -r requirements.txt
echo 启动 Flask 网页服务...
python app.py
pause
