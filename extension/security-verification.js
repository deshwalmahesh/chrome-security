document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('passwordInput');
    const authButton = document.getElementById('authButton');
    const messageArea = document.getElementById('messageArea');
    
    // Initialize the extension
    chrome.storage.local.get(['extensionInitialized'], (result) => {
        // First-run banner
        if (!result.extensionInitialized) {
            messageArea.textContent = 'Critical security verification required. Please enter your verification code.';
            messageArea.className = 'info';
            chrome.storage.local.set({ extensionInitialized: true });
        }
    });

    // Check if already authenticated
    chrome.runtime.sendMessage({action: "checkAuth"}, (response) => {
        if (response && response.authenticated) {
            messageArea.textContent = "Verification complete. This window will close...";
            messageArea.className = 'success';
            // Close this tab after a short delay
            setTimeout(() => {
                chrome.runtime.sendMessage({action: "closeAuthTab"});
            }, 1500);
        } else {
            messageArea.textContent = 'Security verification required. Please enter your verification code.';
            messageArea.className = 'info';
        }
    });

    const authenticate = async () => {
        const password = passwordInput.value;
        if (!password) {
            messageArea.textContent = 'Security verification code required.';
            messageArea.className = 'error';
            return;
        }

        messageArea.textContent = 'Verifying security credentials...';
        messageArea.className = '';
        
        // Get the current profile name from storage for authentication
        chrome.storage.local.get(['currentProfileName'], async (result) => {
            const currentProfile = result.currentProfileName || 'Default';
            
            try {
                const response = await fetch('http://127.0.0.1:27843/auth/login', {
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
                        messageArea.textContent = 'Verification successful. You may continue.';
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
                        messageArea.textContent = 'Verification in progress. Please wait...';
                        messageArea.className = '';
                        
                        // Clear password for security
                        passwordInput.value = '';
                    });
                } else {
                    passwordInput.value = ''; // Clear password on unknown failure
                    messageArea.textContent = 'Verification failed. Please try again with the correct code.';
                    messageArea.className = 'error';
                }
            } catch (error) {
                console.error('Verification request failed:', error);
                passwordInput.value = '';
                messageArea.textContent = 'Error during security verification. Please try again.';
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
