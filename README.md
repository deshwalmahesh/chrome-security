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

1. Clone this repository:
   ```
   git clone <repository-url>
   cd chrome-security
   ```

2. Run the improved setup script which will:
   - Create a virtual environment if it doesn't exist
   - Install all required dependencies
   - Generate a service file with your current user and paths
   - Offer to install the service for you
   ```
   cd backend
   chmod +x setup_service.sh
   sudo ./setup_service.sh
   ```
   
   The script will guide you through the setup process with interactive prompts.

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

The improved setup script handles all the necessary steps to make the service run automatically in the background, even after system restarts:

1. Run the setup script with sudo privileges:
   ```
   cd /path/to/chrome-security/backend
   chmod +x setup_service.sh
   sudo ./setup_service.sh
   ```

   This enhanced script will:
   - Create a service file with your current username and correct paths
   - Check for and install required dependencies
   - Set up a Python virtual environment if needed
   - Offer to install or update the service automatically
   - Verify that the service is properly enabled to run at startup
   - Confirm that the service will run in the background after system restart

2. When prompted, choose 'y' to install the service. This will:
   - Copy the service file to the system directory
   - Enable the service to start automatically at boot time
   - Start the service immediately

3. The script will confirm that the service is active and will run automatically after restart.

4. If you need to manually update an existing service later:
   ```
   sudo ./setup_service.sh
   ```
   And select 'y' when prompted to update the service.

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

3. Check the logs for errors:
   ```
   sudo journalctl -u chrome-security.service
   ```

### Authentication Issues

If you're having trouble authenticating:

1. Make sure you're using the correct password for the profile
2. Check if the backend service is running and accessible
3. Try restarting the browser and the backend service

### Virtual Environment Issues

If you encounter issues with the Python virtual environment:

1. Delete the `venv` directory in the backend folder
2. Run the setup script again to recreate it:
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
