import subprocess
import os
import re
import glob
import sys
import socket
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from passlib.context import CryptContext
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
import json
import argparse
import time

# --- Configuration ---
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "profiles_secret_config.json")
if not os.path.exists(CONFIG_FILE):
    with open(CONFIG_FILE, 'w') as f:
        json.dump({}, f)

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()

# Add CORS middleware to allow requests from the Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*", "http://127.0.0.1:8765"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PasswordAuth(BaseModel):
    password: str
    profile: str = "Default"  # Default to 'Default' profile if not specified

class ProfilePassword(BaseModel):
    profile: str
    password: str

class PasswordChange(BaseModel):
    profile: str
    current_password: str
    new_password: str

# Store active tokens with profile and expiry
active_tokens = {}

# Load profile configurations from file or create default
def load_profiles_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            print(f"Error reading {CONFIG_FILE}, using default configuration")
            # Default configuration if file doesn't exist or is invalid
            return {}
    else:
        with open(CONFIG_FILE, 'w') as f:
            json.dump({}, f)
        return {}

# Save profile configurations to file
def save_profiles_config(config):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)

# Detect Chrome executable
def find_chrome_executable():
    """Find the Chrome executable on the system"""
    # Common Chrome executable names by platform
    if sys.platform == "darwin":  # macOS
        chrome_paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium"
        ]
    elif sys.platform.startswith("linux"):
        chrome_paths = [
            "google-chrome",
            "google-chrome-stable",
            "chrome",
            "chromium",
            "chromium-browser"
        ]
    else:  # Windows or other
        chrome_paths = [
            "chrome.exe",
            "google-chrome.exe",
            "chromium.exe"
        ]
        
    # For macOS and specific paths
    for path in chrome_paths:
        if os.path.isabs(path) and os.path.exists(path) and os.access(path, os.X_OK):
            return path
    
    # For commands in PATH
    for cmd in chrome_paths:
        try:
            # Use 'which' on Unix-like systems
            if sys.platform != "win32":
                result = subprocess.run(["which", cmd], capture_output=True, text=True)
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout.strip()
            # For Windows, we'd need a different approach
            else:
                result = subprocess.run(["where", cmd], capture_output=True, text=True)
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout.strip().splitlines()[0]
        except Exception:
            continue
    
    # Default fallback
    return "google-chrome-stable"

# Find an available port if the default is in use
def find_available_port(default_port=27843, max_attempts=10):
    """Find an available port, starting with the default"""
    port = default_port
    for _ in range(max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("127.0.0.1", port))
                return port
        except OSError:
            port += 1
    return default_port  # Return default if all attempts fail

# Set Chrome executable and port
CHROME_EXECUTABLE = find_chrome_executable()
DEFAULT_PORT = 27843

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def launch_chrome_profile(profile_directory: str | None = None):
    """
    Launches a new Chrome instance with the specified profile or as Guest.
    Does NOT kill existing Chrome instances to allow users to work on multiple profiles.
    """
    try:
        if profile_directory:
            print(f"Launching Chrome with profile: {profile_directory}")
            subprocess.Popen([
                CHROME_EXECUTABLE, 
                f"--profile-directory={profile_directory}",
                "--new-window"  # Ensure it opens in a new window
            ])
        else:
            print("Launching Chrome in Guest mode")
            subprocess.Popen([
                CHROME_EXECUTABLE,
                "--guest",
                "--new-window"  # Ensure it opens in a new window
            ])
    except FileNotFoundError:
        print(f"Error: {CHROME_EXECUTABLE} not found. Please ensure it's in your PATH.")
    except Exception as e:
        print(f"Error launching Chrome: {e}")

def generate_token(profile):
    """Generate a token for the authenticated session with 24-hour expiry"""
    import secrets
    token = secrets.token_urlsafe(32)
    active_tokens[token] = {
        "profile": profile,
        "expires": time.time() + (24 * 60 * 60)  # 24 hours
    }
    return token

@app.post("/auth/login")
async def login_for_access(auth_data: PasswordAuth):
    submitted_password = auth_data.password
    # Use the profile provided by the extension
    current_profile = auth_data.profile
    
    print(f"Login attempt for profile: {current_profile}")
    
    # Load the latest profiles configuration
    profiles_config = load_profiles_config()
    
    # First check if this is a new password for the current profile
    if current_profile:
        # Check if this profile already exists in our config
        profile_exists = False
        for profile_name in profiles_config.values():
            if profile_name == current_profile:
                profile_exists = True
                break
        
        # If profile doesn't exist, add it with this password
        if not profile_exists:
            hashed_password = hash_password(submitted_password)
            profiles_config[hashed_password] = current_profile
            save_profiles_config(profiles_config)
            token = generate_token(current_profile)
            return {"status": "success", "profile_launched": current_profile, "token": token, "message": "Profile password set"}
    
    # Check if the password matches any configured profile
    for hashed_pass, profile_dir in profiles_config.items():
        if verify_password(submitted_password, hashed_pass):
            # Password matches a configured profile
            token = generate_token(profile_dir)
            
            # Check if this is a different profile than the current one
            is_different_profile = current_profile and current_profile != profile_dir
            
            return {
                "status": "success", 
                "profile_launched": profile_dir, 
                "token": token,
                "different_profile": is_different_profile,
                "current_profile": current_profile
            }

    # If no password matched, launch Guest mode
    launch_chrome_profile(None)  # None for profile_directory launches guest
    return {"status": "guest"}

@app.get("/auth/verify")
async def verify_token(token: str):
    """Verify if a token is valid and not expired"""
    if token in active_tokens:
        token_data = active_tokens[token]
        
        # Check if token has expired
        if time.time() < token_data["expires"]:
            return {"valid": True, "profile": token_data["profile"]}
        else:
            # Token expired, remove it
            del active_tokens[token]
    
    return {"valid": False}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/profiles")
async def get_profiles():
    """Get all profiles from both our app and Chrome profiles directory"""
    # Get profiles from our app - load the latest configuration
    profiles_config = load_profiles_config()
    app_profiles = list(profiles_config.values())
    
    # Get profiles from Chrome directory
    chrome_profiles = []
    chrome_dir = os.path.expanduser("~/.config/google-chrome")
    
    if os.path.exists(chrome_dir):
        # Get all directories that could be profiles
        profile_dirs = []
        
        # Add Default profile if it exists
        default_dir = os.path.join(chrome_dir, "Default")
        if os.path.isdir(default_dir):
            profile_dirs.append(("Default", default_dir))
        
        # Add Guest Profile if it exists
        guest_dir = os.path.join(chrome_dir, "Guest Profile")
        if os.path.isdir(guest_dir):
            profile_dirs.append(("Guest Profile", guest_dir))
        
        # Add all Profile X directories
        for profile_path in glob.glob(os.path.join(chrome_dir, "Profile *")):
            if os.path.isdir(profile_path):
                profile_name = os.path.basename(profile_path)
                profile_dirs.append((profile_name, profile_path))
        
        # Extract email from each profile's Preferences file
        for profile_name, profile_path in profile_dirs:
            preferences_file = os.path.join(profile_path, "Preferences")
            email = None
            
            if os.path.exists(preferences_file):
                try:
                    # Use grep to extract email
                    result = subprocess.run(
                        ["grep", "-o", '"email":"[^"]*"', preferences_file],
                        capture_output=True,
                        text=True
                    )
                    
                    if result.returncode == 0:
                        # Extract email from grep output
                        match = re.search('"email":"([^"]+)"', result.stdout)
                        if match:
                            email = match.group(1)
                except Exception as e:
                    print(f"Error extracting email for {profile_name}: {e}")
            
            chrome_profiles.append({
                "name": profile_name,
                "path": profile_path,
                "email": email
            })
    
    return {
        "app_profiles": app_profiles,
        "chrome_profiles": chrome_profiles
    }

@app.post("/admin/add-profile")
async def add_profile(profile_data: ProfilePassword):
    profile_name = profile_data.profile
    password = profile_data.password
    
    # Load the latest profiles configuration
    profiles_config = load_profiles_config()
    
    # Check if this profile already exists
    for hash_key, profile in profiles_config.items():
        if profile == profile_name:
            # Profile already exists, return error
            raise HTTPException(status_code=400, detail=f"Profile {profile_name} already exists. Use change-password endpoint to modify it.")
    
    # Hash the password
    hashed_password = get_password_hash(password)
    
    # Add the new profile with hashed password
    profiles_config[hashed_password] = profile_name
    
    # Save the updated configuration
    save_profiles_config(profiles_config)
    
    return {"status": "success", "message": f"Profile {profile_name} added successfully"}

@app.post("/admin/change-password")
async def change_password(password_data: PasswordChange):
    profile_name = password_data.profile
    current_password = password_data.current_password
    new_password = password_data.new_password
    
    # Load the latest profiles configuration
    profiles_config = load_profiles_config()
    
    # Find the profile and verify current password
    profile_found = False
    current_hash_key = None
    
    for hash_key, profile in profiles_config.items():
        if profile == profile_name:
            profile_found = True
            # Verify the current password
            if not verify_password(current_password, hash_key):
                raise HTTPException(status_code=401, detail="Current password is incorrect")
            current_hash_key = hash_key
            break
    
    if not profile_found:
        raise HTTPException(status_code=404, detail=f"Profile {profile_name} not found")
    
    # Remove the old password entry
    del profiles_config[current_hash_key]
    
    # Add the new password entry
    hashed_new_password = get_password_hash(new_password)
    profiles_config[hashed_new_password] = profile_name
    
    # Save the updated configuration
    save_profiles_config(profiles_config)
    
    return {"status": "success", "message": f"Password for profile {profile_name} changed successfully"}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Chrome Profile Security Backend")
    parser.add_argument("--hash-password", type=str, help="Generate a hash for the given password and exit.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Port to run the server on (default: {DEFAULT_PORT})")
    args = parser.parse_args()

    if args.hash_password:
        hashed = hash_password(args.hash_password)
        print(f"Password: {args.hash_password}")
        print(f"Hashed:   {hashed}")
        print("Copy the hashed value into the profiles_config.json file or use the admin endpoint.")
    else:
        # Load the latest profiles configuration
        profiles_config = load_profiles_config()
        print("Starting FastAPI server for Chrome Profile Security...")
        print(f"Using Chrome executable: {CHROME_EXECUTABLE}")
        print("Loaded profile configurations:", list(profiles_config.values()))
        
        # Find an available port if the specified one is in use
        port = find_available_port(args.port)
        if port != args.port:
            print(f"Warning: Port {args.port} is in use. Using port {port} instead.")
        
        print(f"Server running at http://127.0.0.1:{port}")
        uvicorn.run("app:app", host="127.0.0.1", port=port, reload=True)
