// Check if the server is running
async function isServerRunning() {
  try {
    const response = await fetch('http://127.0.0.1:27843/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Short timeout to avoid hanging
      signal: AbortSignal.timeout(2000)
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.status === 'healthy';
    }
    return false;
  } catch (error) {
    console.error("Server health check failed:", error);
    return false;
  }
}

async function detectCurrentProfile(chromeProfiles) {
  return new Promise((resolve) => {
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
      const email = userInfo.email || "";          // Blank => Guest / unsigned
      const match = chromeProfiles.find(p => p.email === email);
      if (match) return resolve(match.name);
      resolve(email ? "Unknown-signed-in" : "Guest/Default");
    });
  });
}


// Function to redirect a tab to the authentication page
function redirectToAuth(tabId) {
  const authPageUrl = chrome.runtime.getURL("security-verification.html");
  chrome.tabs.update(tabId, { url: authPageUrl });
}

// Check if the profile is authenticated
function isAuthenticated() {
  return new Promise(resolve => {
    chrome.storage.local.get(['profileAuthenticated', 'authToken', 'tokenExpiry'], (result) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      
      // Check if we have a valid token that hasn't expired
      if (result.profileAuthenticated && result.authToken) {
        // If token has expiry and hasn't expired yet
        if (result.tokenExpiry && Date.now() < result.tokenExpiry) {
          resolve(true);
          return;
        }
        
        // If token has no expiry (backward compatibility) or has expired
        // Verify with the server
        verifyToken(result.authToken).then(isValid => {
          resolve(isValid);
        });
      } else {
        resolve(false);
      }
    });
  });
}

// Verify token with the server
async function verifyToken(token) {
  try {
    const response = await fetch(`http://127.0.0.1:27843/auth/verify?token=${token}`);
    if (response.ok) {
      const data = await response.json();
      if (data.valid) {
        // Update token expiry
        const expiry = Date.now() + (12 * 60 * 60 * 1000); // 12 hours from now
        chrome.storage.local.set({ 
          profileAuthenticated: true,
          tokenExpiry: expiry
        });
        return true;
      }
    }
    
    // Token invalid or expired
    chrome.storage.local.set({ profileAuthenticated: false });
    chrome.storage.local.remove(['authToken', 'tokenExpiry']);
    return false;
  } catch (error) {
    console.error("Error verifying token:", error);
    // If server is down, invalidate authentication for security
    chrome.storage.local.set({ profileAuthenticated: false });
    chrome.storage.local.remove(['authToken', 'tokenExpiry']);
    return false;
  }
}

// Lock the profile by removing authentication status and tokens
async function lockProfile() {
  try {
    return new Promise((resolve) => {
      chrome.storage.local.set({ profileAuthenticated: false }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error locking profile:", chrome.runtime.lastError);
          resolve(false);
          return;
        }
        
        chrome.storage.local.remove(['authToken', 'tokenExpiry'], () => {
          if (chrome.runtime.lastError) {
            console.error("Error removing auth tokens:", chrome.runtime.lastError);
            resolve(false);
            return;
          }
          console.log("Profile locked successfully");
          resolve(true);
        });
      });
    });
  } catch (error) {
    console.error("Unexpected error in lockProfile:", error);
    return false;
  }
}

// Listener for tab updates (e.g., new tab, navigation)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Check if the tab is loading and has a URL
  if (changeInfo.status === 'loading' && tab.url) {
    // Avoid redirecting the auth page itself or internal chrome pages
    if (tab.url.startsWith(chrome.runtime.getURL("")) || 
        tab.url.startsWith("chrome://")) {
      return;
    }

    // Check authentication status first
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      redirectToAuth(tabId);
      return;
    }

    // If authenticated, verify with server (if available)
    const serverRunning = await isServerRunning();
    if (!serverRunning) {
      console.log("Security verification service not running - staying locked for security");
      redirectToAuth(tabId);
      return;
    }
  }
});

// Optional: Check on new window creation too
chrome.windows.onCreated.addListener(async (window) => {
  // When a new window is created, check its active tab
  setTimeout(async () => { // Allow tab to be created
    try {
      // First check if server is running
      const serverRunning = await isServerRunning();
      if (!serverRunning) {
        console.log("Security verification service not running, skipping verification check on new window");
        return;
      }
      
      // Always lock the profile when a new window is created
      await lockProfile();
      
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
          if (chrome.runtime.lastError) {
            console.error("Error querying tabs:", chrome.runtime.lastError);
            return;
          }
          
          if (tabs && tabs.length > 0) {
            const tab = tabs[0];
            if (tab.url && 
                !tab.url.startsWith(chrome.runtime.getURL("")) && 
                !tab.url.startsWith("chrome://")) {
              redirectToAuth(tab.id);
            }
          }
        });
      }
    } catch (error) {
      console.error("Error handling new window creation:", error);
    }
  }, 100); // Small delay
});

// Run when extension is installed or updated
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("Extension installed or updated:", details.reason);
  
  // Detect current Chrome profile
  try {
    const response = await fetch('http://127.0.0.1:27843/profiles');
    if (response.ok) {
      const data = await response.json();
      const chromeProfiles = data.chrome_profiles || [];

      // Ask the Identity API which profile this extension is running in
      const currentProfile = await detectCurrentProfile(chromeProfiles);
      chrome.storage.local.set({ currentProfileName: currentProfile }, () => {
        console.log(`Current Chrome profile detected: ${currentProfile}`);
      });
    }
  } catch (error) {
    console.error("Error detecting Chrome profile:", error);
  }
  
  try {
    // Lock the profile automatically using the lockProfile function
    await lockProfile();
    console.log("Profile locked on extension install/update.");
    
    // Redirect to auth page immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error("Error querying tabs:", chrome.runtime.lastError);
        return;
      }
      
      if (tabs && tabs.length > 0) {
        redirectToAuth(tabs[0].id);
      }
    });
  } catch (error) {
    console.error("Error during extension installation/update:", error);
  }
});

// Run when browser starts (extension is loaded)
chrome.runtime.onStartup.addListener(async () => {
  console.log("Browser started, initiating security verification...");
  
  // Detect current Chrome profile
  try {
    const response = await fetch('http://127.0.0.1:27843/profiles');
    if (response.ok) {
      const data = await response.json();
      const chromeProfiles = data.chrome_profiles || [];
      
      // Ask the Identity API which profile this extension is running in
      const currentProfile = await detectCurrentProfile(chromeProfiles);
      chrome.storage.local.set({ currentProfileName: currentProfile }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error setting profile name:", chrome.runtime.lastError);
          return;
        }
        console.log(`Current Chrome profile detected: ${currentProfile}`);
      });
    }
  } catch (error) {
    console.error("Error detecting Chrome profile:", error);
  }
  
  try {
    // Lock the profile automatically using the lockProfile function
    await lockProfile();
    console.log("Profile locked on browser start.");
    
    // Redirect to auth page immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error("Error querying tabs:", chrome.runtime.lastError);
        return;
      }
      
      if (tabs && tabs.length > 0) {
        redirectToAuth(tabs[0].id);
      }
    });
  } catch (error) {
    console.error("Error during browser startup:", error);
  }
});

// Message listener for logout and other messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "logout") {
    chrome.storage.local.set({ profileAuthenticated: false }, () => {
      console.log("Profile locked (logged out).");
      chrome.storage.local.remove(['authToken', 'tokenExpiry']);
      // Find active tab in current window and redirect to auth page
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          redirectToAuth(tabs[0].id);
        }
      });
      sendResponse({ status: "logged_out" });
    });
    return true; // Indicates an asynchronous response
  }
  
  // Check authentication status
  if (request.action === "checkAuth") {
    isAuthenticated().then(authenticated => {
      sendResponse({ authenticated: authenticated });
    });
    return true; // Indicates an asynchronous response
  }
  
  // Set authentication status after successful login
  if (request.action === "setAuth") {
    const { token, expiry } = request.data || {};
    chrome.storage.local.set({ 
      profileAuthenticated: true,
      authToken: token,
      tokenExpiry: expiry || (Date.now() + (24 * 60 * 60 * 1000)) // Default 24h expiry
    }, () => {
      sendResponse({ status: "auth_set" });
    });
    return true; // Indicates an asynchronous response
  }
  
  // Close the authentication tab after successful login
  if (request.action === "closeAuthTab") {
    // Close the sender tab
    if (sender && sender.tab && sender.tab.id) {
      const tabId = sender.tab.id;
      console.log("Authentication successful, handling tab closure:", tabId);
      
      // First, check how many tabs are open in the window
      chrome.tabs.query({ windowId: sender.tab.windowId }, (tabs) => {
        // If this is the only tab, create a new tab first
        if (tabs.length === 1) {
          console.log("Only one tab open, creating new tab before closing");
          chrome.tabs.create({ url: "chrome://newtab" }, (newTab) => {
            // After creating a new tab, close the auth tab
            chrome.tabs.remove(tabId);
          });
        } else {
          // Multiple tabs open, safe to close this one
          console.log("Multiple tabs open, closing auth tab");
          chrome.tabs.remove(tabId);
        }
      });
    }
    return true; // Asynchronous response needed
  }
  
  // Close the current window when a different profile is being opened
  if (request.action === "closeCurrentWindow") {
    if (sender && sender.tab && sender.tab.windowId) {
      console.log("Closing current window as a different profile is being opened:", request.profileToLaunch);
      chrome.windows.remove(sender.tab.windowId);
    }
    return false; // No asynchronous response needed
  }
});
