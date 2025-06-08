#!/bin/bash

# Check if running as root and warn if not
if [ "$(id -u)" -ne 0 ]; then
    echo "⚠️  Warning: This script is not running as root. Some operations might fail."
    echo "Consider running with sudo if you encounter permission issues."
    echo
fi

# Get the current user (even if script is run with sudo)
if [ -n "$SUDO_USER" ]; then
    CURRENT_USER=$SUDO_USER
else
    CURRENT_USER=$(whoami)
fi

# Get the absolute path to the project directory
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../" &> /dev/null && pwd )"
BACKEND_DIR="$PROJECT_DIR/backend"

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
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Service file created at $BACKEND_DIR/chrome-security.service"
echo

# Check if the service is already installed
if [ -f "/etc/systemd/system/chrome-security.service" ]; then
    echo "🔄 Service is already installed. Would you like to update it? (y/n)"
    read -r update_service
    
    if [[ $update_service =~ ^[Yy]$ ]]; then
        echo "🔄 Updating service..."
        cp "$BACKEND_DIR/chrome-security.service" "/etc/systemd/system/"
        systemctl daemon-reload
        systemctl restart chrome-security.service
        echo "✅ Service updated and restarted."
    fi
else
    echo "🔧 Service is not installed. Would you like to install it now? (y/n)"
    read -r install_service
    
    if [[ $install_service =~ ^[Yy]$ ]]; then
        echo "🔧 Installing service..."
        cp "$BACKEND_DIR/chrome-security.service" "/etc/systemd/system/"
        systemctl daemon-reload
        systemctl enable chrome-security.service
        systemctl start chrome-security.service
        echo "✅ Service installed and started."
    else
        echo "ℹ️  To install the service later, run:"
        echo "   sudo cp $BACKEND_DIR/chrome-security.service /etc/systemd/system/"
        echo "   sudo systemctl daemon-reload"
        echo "   sudo systemctl enable chrome-security.service"
        echo "   sudo systemctl start chrome-security.service"
    fi
fi

# Check current service status if it exists
echo
echo "🔍 Checking service status..."
if systemctl is-active --quiet chrome-security.service; then
    echo "✅ Service status: ACTIVE (running in background)"
    echo "   The service will automatically start when you reboot your system."
elif systemctl is-enabled --quiet chrome-security.service; then
    echo "⚠️  Service status: ENABLED but not running"
    echo "   To start the service now, run: sudo systemctl start chrome-security.service"
else
    echo "ℹ️  Service status: NOT INSTALLED or DISABLED"
fi
