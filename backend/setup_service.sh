#!/bin/bash

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "❌ This script must be run as root (sudo). Please run with sudo."
    exit 1
fi

# Get the current user (even if script is run with sudo)
if [ -n "$SUDO_USER" ]; then
    CURRENT_USER=$SUDO_USER
else
    CURRENT_USER=$(whoami)
fi

# Get the absolute path to the project directory - works regardless of where the script is run from
SCRIPT_PATH="$(readlink -f "$0")"
BACKEND_DIR="$(dirname "$SCRIPT_PATH")"
PROJECT_DIR="$(dirname "$BACKEND_DIR")"

# Ensure we're using the actual path, not a symlink path
BACKEND_DIR="$(cd "$BACKEND_DIR" && pwd)"
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"

echo "📋 Setting up Chrome Security Service..."
echo "User: $CURRENT_USER"
echo "Project directory: $PROJECT_DIR"
echo "Backend directory: $BACKEND_DIR"
echo

# Check for Python and required packages
echo "🔍 Checking dependencies..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.7 or newer."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "🔧 Creating Python virtual environment..."
    python3 -m venv "$BACKEND_DIR/venv"
    
    echo "📦 Installing required packages..."
    source "$BACKEND_DIR/venv/bin/activate"
    pip install fastapi uvicorn passlib python-multipart
    deactivate
    echo "✅ Virtual environment setup complete."
fi

# Create the service file with dynamic paths
echo "🔧 Creating service file..."
cat > "$BACKEND_DIR/chrome-security.service" << EOF
[Unit]
Description=Chrome Security Backend Service
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$BACKEND_DIR
ExecStart=/bin/bash $BACKEND_DIR/startup.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Service file created at $BACKEND_DIR/chrome-security.service"
echo

# Stop the service if it's running
if systemctl is-active --quiet chrome-security.service; then
    echo "🛑 Stopping existing service..."
    systemctl stop chrome-security.service
fi

# Install or update the service
echo "🔧 Installing/updating service..."
cp "$BACKEND_DIR/chrome-security.service" "/etc/systemd/system/"
systemctl daemon-reload
systemctl enable chrome-security.service
systemctl start chrome-security.service

# Check current service status
echo
echo "🔍 Checking service status..."
if systemctl is-active --quiet chrome-security.service; then
    echo "✅ Service status: ACTIVE (running in background)"
    echo "   The service will automatically start when you reboot your system."
else
    echo "❌ Service failed to start. Checking logs..."
    journalctl -u chrome-security.service --no-pager -n 20
fi

echo
echo "✅ Setup complete! The Chrome Security service is now configured to start automatically on boot."
echo "   You can check its status anytime with: sudo systemctl status chrome-security.service"
echo "   To restart it manually: sudo systemctl restart chrome-security.service"
echo "   To view logs: sudo journalctl -u chrome-security.service -f"
echo
echo "🔒 Your Chrome Security service is now ready to use!"
