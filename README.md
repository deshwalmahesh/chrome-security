# Chrome Security Verification

A Chrome extension with a backend service that provides an additional layer of security for your Chrome browser by requiring password authentication before allowing access to browsing.

## What This Does

Chrome Security Verification adds an extra security layer to your Chrome browser by:

1. Requiring password authentication before allowing browsing
2. Supporting multiple Chrome profiles with different passwords
3. Automatically locking the browser when a new window is opened
4. Preventing unauthorized access to your browsing sessions

## How It Works

The system consists of two main components:

### 1. Chrome Extension (Frontend)

- Intercepts new tab and window creation events
- Redirects to an authentication page when the browser is locked
- Communicates with the backend service to verify authentication
- Manages authentication tokens and session state

### 2. Backend Service (Python FastAPI)

- Provides authentication endpoints for the extension
- Manages profile passwords and verification
- Detects Chrome profiles and their associated emails
- Handles token generation and verification for secure sessions

## Installation

### Prerequisites

- Google Chrome browser
- Python 3.7+ (for the backend service)
- pip (Python package manager)
- Linux with systemd (for service installation)

### Setting Up the Backend

#### Option 1: For Users (Distribution)

1. Download or extract the release package:
   ```
   unzip chrome-security.zip
   cd chrome-security
   ```

2. Run the setup script with sudo (required for service installation):
   ```
   cd backend
   chmod +x setup_service.sh
   sudo ./setup_service.sh
   ```
   
   The script will automatically:
   - Create a Python virtual environment if needed
   - Install all required dependencies
   - Configure the service with correct paths
   - Install and start the service
   - Verify the service is running properly

#### Option 2: For Developers

1. Clone this repository:
   ```
   git clone <repository-url>
   cd chrome-security
   ```

2. Run the setup script:
   ```
   cd backend
   chmod +x setup_service.sh
   sudo ./setup_service.sh
   ```

### Setting Up the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked" and select the `extension` folder from this repository

## Running the Application

### Starting the Backend Service Manually

1. Navigate to the backend directory:
   ```
   cd /path/to/chrome-security/backend
   ```

2. Activate the virtual environment (if you created one):
   ```
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Start the backend service:
   ```
   python app.py
   ```

### Setting Up the Backend Service to Run on System Startup

#### Using Systemd (Recommended for Linux)

The setup script automatically handles all the necessary steps to make the service run on system startup:

1. When you run the setup script with sudo privileges:
   ```
   cd /path/to/chrome-security/backend
   chmod +x setup_service.sh
   sudo ./setup_service.sh
   ```

   The script will automatically:
   - Create a service file with the correct paths and your username
   - Install all required dependencies
   - Set up a Python virtual environment if needed
   - Install and enable the service to run at system startup
   - Start the service immediately
   - Verify that the service is running properly

2. The service is configured with:
   - Automatic restart if it crashes
   - Proper dependency management (starts after network is available)
   - Logging to help with troubleshooting

3. To update an existing installation, simply run the setup script again:
   ```
   sudo ./setup_service.sh
   ```
   
   The script will detect the existing service, stop it, update it, and restart it automatically.

## Service Management Commands

### Checking Service Status

```
sudo systemctl status chrome-security.service
```

### Starting the Service

```
sudo systemctl start chrome-security.service
```

### Stopping the Service

```
sudo systemctl stop chrome-security.service
```

### Restarting the Service

```
sudo systemctl restart chrome-security.service
```

### Enabling Service to Start on Boot

```
sudo systemctl enable chrome-security.service
```

### Disabling Service from Starting on Boot

```
sudo systemctl disable chrome-security.service
```

## Usage

1. After installing the extension and starting the backend service, open Chrome
2. The extension will automatically lock your browser and redirect to the authentication page
3. Enter your password to unlock the browser
   - For new profiles, the first password you enter will be set as that profile's password
   - For existing profiles, you must enter the correct password

## Troubleshooting

### Backend Service Not Running

If the extension shows "Security verification service not running":

1. Check if the backend service is running:
   ```
   sudo systemctl status chrome-security.service
   ```

2. If not running, start it:
   ```
   sudo systemctl start chrome-security.service
   ```

3. Check the service logs for errors:
   ```
   sudo journalctl -u chrome-security.service -n 50 --no-pager
   ```

4. Check the application logs:
   ```
   cat /path/to/chrome-security/backend/service.log
   ```

5. If the service keeps stopping, try running the setup script again to fix any path issues:
   ```
   cd /path/to/chrome-security/backend
   sudo ./setup_service.sh
   ```

### Authentication Issues

If you're having trouble authenticating:

1. Make sure you're using the correct password for the profile
2. Check if the backend service is running and accessible by visiting http://127.0.0.1:27843/health in your browser
3. Try restarting the browser and the backend service
4. Check the service logs for any authentication errors

### Virtual Environment Issues

If you encounter issues with the Python virtual environment:

1. The improved setup script should automatically create or repair the virtual environment
2. If you still have issues, you can manually recreate it:
   ```
   cd /path/to/chrome-security/backend
   rm -rf venv
   python3 -m venv venv
   source venv/bin/activate
   pip install fastapi uvicorn passlib python-multipart
   ```
3. Then run the setup script again to reinstall the service:
   ```
   sudo ./setup_service.sh
   ```

### Distribution Issues

If you're distributing this tool to others and they're having issues:

1. Make sure they have Python 3.7+ installed
2. Ensure they run the setup script with sudo privileges
3. Check that the Chrome extension is properly loaded
4. Verify that port 27843 is not being used by another application
   ```
   sudo ./setup_service.sh
   ```

### Permission Issues

If you encounter permission errors:

1. Make sure you're running the setup script with sudo:
   ```
   sudo ./setup_service.sh
   ```
2. Check that your user has appropriate permissions for the project directory

## Distributing the Application

To distribute this application to other users:

1. Share the entire repository with them (via Git clone or as a zip file)
2. Instruct them to follow the installation steps in this README
3. The setup script will automatically:
   - Adapt all paths to their system
   - Create the service file with their username
   - Install required dependencies
   - Set up the service to run at startup

### Distribution Checklist

- ✅ The `.gitignore` file is configured to exclude sensitive files
- ✅ The setup script dynamically generates the service file with the current user's information
- ✅ All hardcoded paths are replaced with dynamic paths during installation
- ✅ The service is configured to run in the background after system restart

## Security Considerations

- Passwords are securely hashed using bcrypt before storage
- Authentication tokens expire after 24 hours
- The backend service only accepts connections from localhost
- Profile passwords are stored in a separate configuration file

## License

[Your License Information]
