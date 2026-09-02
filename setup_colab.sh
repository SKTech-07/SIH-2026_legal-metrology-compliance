#!/bin/bash

set -e

echo "======================================"
echo "Legal Metrology - Colab Setup"
echo "======================================"

echo ""
echo "Checking GPU..."
nvidia-smi

echo ""
echo "Installing Python 3.11.9..."

apt-get update -qq
apt-get install -y -qq build-essential wget \
    libssl-dev zlib1g-dev libbz2-dev libreadline-dev \
    libsqlite3-dev libffi-dev liblzma-dev tk-dev \
    libncurses5-dev libncursesw5-dev uuid-dev

cd /tmp

wget -q https://www.python.org/ftp/python/3.11.9/Python-3.11.9.tgz

tar -xzf Python-3.11.9.tgz
cd Python-3.11.9

./configure --prefix=/usr/local/python3.11 --enable-optimizations
make -j2
make install

echo ""
echo "Python version:"
/usr/local/python3.11/bin/python3.11 --version

echo ""
echo "Creating virtual environment..."

rm -rf /content/legal_metrology_env

/usr/local/python3.11/bin/python3.11 -m venv /content/legal_metrology_env

echo ""
echo "Upgrading pip..."

/content/legal_metrology_env/bin/python -m pip install --upgrade pip

echo ""
echo "Installing PaddlePaddle GPU..."

/content/legal_metrology_env/bin/python -m pip install \
    paddlepaddle-gpu==3.3.1 \
    -i https://www.paddlepaddle.org.cn/packages/stable/cu126/

echo ""
echo "Installing PaddleOCR..."

/content/legal_metrology_env/bin/python -m pip install paddleocr

echo ""
echo "Verifying installation..."

/content/legal_metrology_env/bin/python -c "
import paddle
from paddleocr import PaddleOCR

print('--------------------------------------')
print('Paddle version:', paddle.__version__)
print('CUDA:', paddle.device.is_compiled_with_cuda())
print('Device:', paddle.device.get_device())
print('PaddleOCR: imported successfully')
print('--------------------------------------')
"

echo ""
echo "======================================"
echo "SETUP COMPLETED SUCCESSFULLY"
echo "======================================"
