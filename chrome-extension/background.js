// StartupHub Extension Background Service Worker

// 1. Listen for the global OS shortcut command
chrome.commands.onCommand.addListener((command) => {
  console.log(`Received command: ${command}`);
  if (command === 'capture-idea') {
    // Open a floating popup window
    chrome.windows.create({
      url: 'popup.html?mode=global',
      type: 'popup',
      width: 460,
      height: 500,
      focused: true
    }, (window) => {
      console.log('Opened standalone Idea Capture window', window);
    });
  }
});

// 2. Proxy API requests from popup to bypass CORS limits
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SUBMIT_IDEA') {
    const { title, description } = request.data;
    
    // We send to localhost:3001/api/ideas
    fetch('http://localhost:3001/api/ideas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        description,
        source: 'slack' // Default capture source
      })
    })
    .then(async (response) => {
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : null;
      
      if (!response.ok) {
        throw new Error(data?.error || `Server error: ${response.status}`);
      }
      
      sendResponse({ success: true, data });
    })
    .catch((error) => {
      console.error('Failed to submit idea:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep message channel open for async response
  }
});
