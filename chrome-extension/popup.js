// StartupHub Extension Popup Controller

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('ideaForm');
  const titleInput = document.getElementById('title');
  const descInput = document.getElementById('description');
  
  const loadingOverlay = document.getElementById('loadingOverlay');
  const successOverlay = document.getElementById('successOverlay');
  const successDesc = document.getElementById('successDesc');
  
  const closeBtn = document.getElementById('closeBtn');
  const doneBtn = document.getElementById('doneBtn');
  const shortcutKeys = document.getElementById('shortcutKeys');
  
  // Focus title immediately
  titleInput.focus();

  // Determine OS to show correct shortcut keys
  chrome.runtime.getPlatformInfo((info) => {
    if (info.os === 'mac') {
      shortcutKeys.textContent = 'Cmd+Shift+Y';
    } else {
      shortcutKeys.textContent = 'Ctrl+Shift+Y';
    }
  });

  // Handle Cancel / Close buttons
  const closeWindow = () => {
    window.close();
  };
  
  closeBtn.addEventListener('click', closeWindow);
  doneBtn.addEventListener('click', closeWindow);

  // Form Submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    
    if (!title || !description) return;
    
    // Show loading overlay
    loadingOverlay.style.display = 'flex';
    
    // Send message to background script to perform fetch (to bypass CORS)
    chrome.runtime.sendMessage(
      {
        type: 'SUBMIT_IDEA',
        data: { title, description }
      },
      (response) => {
        loadingOverlay.style.display = 'none';
        
        if (response && response.success) {
          // Success! Show success overlay
          successDesc.textContent = `"${title}" has been successfully added to your StartupHub workspace.`;
          successOverlay.style.display = 'flex';
          
          // Clear inputs
          form.reset();
        } else {
          // Error handling
          const errorMsg = response ? response.error : 'Unable to connect to the StartupHub server.';
          alert(`Error: ${errorMsg}\n\nPlease make sure the StartupHub backend is running at http://localhost:3001.`);
        }
      }
    );
  });
});
