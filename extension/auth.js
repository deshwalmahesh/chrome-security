document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('passwordInput');
    const authButton = document.getElementById('authButton');
    const messageArea = document.getElementById('messageArea');
    const profileLabel = document.getElementById('profileLabel');
    
    // Always load the detected profile name immediately
    chrome.storage.local.get(['currentProfileName', 'extensionInitialized'], (result) => {
        const profileName = result.currentProfileName || 'Default';
        profileLabel.textContent = `MMLP Enterprise Profile: ${profileName}`;

        // First-run banner
        if (!result.extensionInitialized) {
            messageArea.textContent = `Please set a security password for company profile "${profileName}".`;
            messageArea.className = 'info';
            chrome.storage.local.set({ extensionInitialized: true });
        }
    });

    // Check if already authenticated
    chrome.runtime.sendMessage({action: "checkAuth"}, (response) => {
        if (response && response.authenticated) {
            messageArea.textContent = "Already authenticated. Closing this tab...";
            messageArea.className = 'success';
            // Close this tab after a short delay
            setTimeout(() => {
                chrome.runtime.sendMessage({action: "closeAuthTab"});
            }, 1500);
        } else {
            // Show current profile name if available
            chrome.storage.local.get(['currentProfileName'], (result) => {
                if (result.currentProfileName) {
                    messageArea.textContent = `Please authenticate to access this company-managed profile`;
                    messageArea.className = 'info';
                }
            });
        }
    });

    const authenticate = async () => {
        const password = passwordInput.value;
        if (!password) {
            messageArea.textContent = 'Please enter a password.';
            messageArea.className = 'error';
            return;
        }

        messageArea.textContent = 'Authenticating...';
        messageArea.className = '';
        
        // Get the current profile name from storage
        chrome.storage.local.get(['currentProfileName'], async (result) => {
            const currentProfile = result.currentProfileName || 'Default';
            console.log(`Authenticating for profile: ${currentProfile}`);
            
            try {
                const response = await fetch('http://127.0.0.1:8765/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        password: password,
                        profile: currentProfile 
                    }),
                });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                // Successful login: store token plus the profile string we just used
                const token = data.token;
                const expiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
                
                // Check if we're opening a different profile
                const isDifferentProfile = data.different_profile === true;
                
                // Notify background script of successful authentication
                chrome.runtime.sendMessage({
                    action: "setAuth", 
                    data: { token, expiry, profile: data.profile_launched }
                }, () => {
                    if (isDifferentProfile) {
                        messageArea.textContent = `Authentication successful. Launching different profile: ${data.profile_launched}. This window will close.`;
                    } else {
                        messageArea.textContent = `Authentication successful.`; // Profile: ${data.profile_launched} unlocked.`;
                    }
                    messageArea.className = 'success';
                    
                    // Clear password for security
                    passwordInput.value = '';
                    
                    // Give user feedback before closing the tab/window
                    setTimeout(() => {
                        if (isDifferentProfile) {
                            // If opening a different profile, close the current window
                            chrome.runtime.sendMessage({
                                action: "closeCurrentWindow",
                                profileToLaunch: data.profile_launched
                            });
                        } else {
                            // Just close this tab
                            chrome.runtime.sendMessage({action: "closeAuthTab"});
                        }
                    }, 1500);
                });
            } else if (data.status === 'guest') {
                // If launching guest, ensure this profile is marked as not authenticated
                chrome.runtime.sendMessage({action: "logout"}, () => {
                    messageArea.textContent = 'Launching Guest mode. This page will close or refresh.';
                    messageArea.className = '';
                    
                    // Clear password for security
                    passwordInput.value = '';
                });
            } else {
                passwordInput.value = ''; // Clear password on unknown failure
                messageArea.textContent = 'Authentication failed. Please try again or contact support.';
                messageArea.className = 'error';
            }
            } catch (error) {
                console.error('Authentication request failed:', error);
                passwordInput.value = '';
                messageArea.textContent = 'Error communicating with auth service. Is it running?';
                messageArea.className = 'error';
            }
        });
    };

    authButton.addEventListener('click', authenticate);
    passwordInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            authenticate();
        }
    });
});
