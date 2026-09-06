#!/bin/bash

set -e

echo "=========================================="
echo " Legal Metrology - ML/Colab Setup"
echo "=========================================="

# --------------------------------------------------
# 1. Check GPU
# --------------------------------------------------

echo ""
echo "[1/6] Checking GPU..."

nvidia-smi

# --------------------------------------------------
# 2. Install system dependencies
# --------------------------------------------------

echo ""
echo "[2/6] Installing system dependencies..."

apt-get update -qq

apt-get install -y -qq \
    build-essential \
    wget \
    libssl-dev \
    zlib1g-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    libffi-dev \
    liblzma-dev \
    tk-dev \
    libncurses5-dev \
    libncursesw5-dev \
    uuid-dev

# --------------------------------------------------
# 3. Install Python 3.11.9
# --------------------------------------------------

echo ""
echo "[3/6] Installing Python 3.11.9..."

if [ ! -f "/usr/local/python3.11/bin/python3.11" ]; then

    cd /tmp

    if [ ! -f "Python-3.11.9.tgz" ]; then
        wget -q \
        https://www.python.org/ftp/python/3.11.9/Python-3.11.9.tgz
    fi

    if [ ! -d "Python-3.11.9" ]; then
        tar -xzf Python-3.11.9.tgz
    fi

    cd Python-3.11.9

    ./configure \
        --prefix=/usr/local/python3.11 \
        --enable-optimizations

    make -j2
    make install

fi

/usr/local/python3.11/bin/python3.11 --version

# --------------------------------------------------
# 4. Create virtual environment
# --------------------------------------------------

echo ""
echo "[4/6] Creating Python virtual environment..."

ENV_PATH="/content/legal_metrology_env"

if [ ! -d "$ENV_PATH" ]; then
    /usr/local/python3.11/bin/python3.11 \
        -m venv "$ENV_PATH"
fi

PYTHON="$ENV_PATH/bin/python"

$PYTHON --version

# --------------------------------------------------
# 5. Install ML dependencies
# --------------------------------------------------

echo ""
echo "[5/6] Installing ML dependencies..."

$PYTHON -m pip install --upgrade pip

echo ""
echo "Installing PaddlePaddle GPU..."

SETUPTOOLS_USE_DISTUTILS=stdlib $PYTHON -m pip install \
    paddlepaddle-gpu==3.3.1 \
    -i https://www.paddlepaddle.org.cn/packages/stable/cu126/

echo ""
echo "Installing PaddleOCR..."

$PYTHON -m pip install paddleocr

echo ""
echo "Installing additional ML/image packages..."

$PYTHON -m pip install \
    opencv-contrib-python==4.10.0.84 \
    Pillow \
    scikit-learn \
    pandas \
    PyYAML \
    tqdm

# --------------------------------------------------
# 6. Verify installation
# --------------------------------------------------

echo ""
echo "[6/6] Verifying installation..."

$PYTHON -c "
import paddle
from paddleocr import PaddleOCR

print()
print('==========================================')
print('        ENVIRONMENT VERIFICATION')
print('==========================================')
print('Python      :', __import__('sys').version.split()[0])
print('Paddle      :', paddle.__version__)
print('CUDA        :', paddle.device.is_compiled_with_cuda())
print('Device      :', paddle.device.get_device())
print('PaddleOCR   : imported successfully')
print('==========================================')
"

echo ""
echo "=========================================="
echo " SETUP COMPLETED SUCCESSFULLY"
echo "=========================================="
