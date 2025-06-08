document.addEventListener('DOMContentLoaded', () => {
    const statusMessage = document.getElementById('statusMessage');
    const lockButton = document.getElementById('lockButton');

    // Check authentication status
    chrome.runtime.sendMessage({action: "checkAuth"}, (response) => {
        if (response && response.authenticated) {
            statusMessage.textContent = "Security verification complete";
            statusMessage.className = "status unlocked";
        } else {
            statusMessage.textContent = "Security verification required";
            statusMessage.className = "status locked";
        }
    });

    // Add verification button functionality
    lockButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({action: "logout"}, (response) => {
            if (response && response.status === "logged_out") {
                statusMessage.textContent = "Security verification required";
                statusMessage.className = "status locked";
                
                // Close the popup and redirect active tab to auth page
                window.close();
            }
        });
    });
});
