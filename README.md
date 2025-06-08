# Chrome Security Verification

A Chrome extension with a backend service that adds security to your browser by requiring password authentication before allowing browsing.

## Features

- Password protection for Chrome browsing
- Support for multiple Chrome profiles with different passwords
- Auto-locks when a new window is opened
- Prevents unauthorized access to your browsing sessions

## Components

- **Chrome Extension**: Manages the authentication UI and browser locking
- **Backend Service**: Handles password verification and profile management

## Installation

### Prerequisites

- Google Chrome browser
- Python 3.7+
- Linux with systemd

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/deshwalmahesh/chrome-security
   cd chrome-security
   ```

2. Install the backend service:
   ```
   cd backend
   chmod +x setup_service.sh
   sudo ./setup_service.sh
   ```

3. Install the Chrome extension:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the `extension` folder

### Manual Backend Start

If needed, you can start the backend manually:

```
cd chrome-security/backend
source venv/bin/activate
python app.py
```

## Service Management

```
# Check status
sudo systemctl status chrome-security.service

# Start/stop/restart
sudo systemctl start chrome-security.service
sudo systemctl stop chrome-security.service
sudo systemctl restart chrome-security.service
```

## Usage

1. After installing, open Chrome
2. The extension will lock your browser and show the authentication page
3. Enter your password to unlock the browser
   - For new profiles, the first password you enter becomes that profile's password
   - For existing profiles, enter the correct password

## Troubleshooting

If the extension shows "Security verification service not running":

```
# Check if service is running
sudo systemctl status chrome-security.service

# Start if not running
sudo systemctl start chrome-security.service

# Check logs if problems persist
sudo journalctl -u chrome-security.service -n 20
```

## Security

- Passwords are securely hashed with bcrypt
- Authentication tokens expire after 24 hours
- Backend only accepts localhost connections
- Each profile has its own password
