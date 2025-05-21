document.addEventListener('DOMContentLoaded', function() {
  // Get the button element
  const actionButton = document.getElementById('action-button');
    // Check overlay status and update button text
  function updateButtonState() {
    chrome.storage.sync.get('overlayActive', function(data) {
      if (data.overlayActive) {
        actionButton.textContent = 'Close Speed Reader';
        actionButton.classList.add('active');
      } else {
        actionButton.textContent = 'Open Speed Reader';
        actionButton.classList.remove('active');
      }
    });
  }
  
  // Initialize button state
  updateButtonState();
  
  // Add a click event listener
  actionButton.addEventListener('click', function() {
    // Send a message to the background script
    chrome.runtime.sendMessage({ action: 'buttonClicked' }, function(response) {
      if (response && response.status === 'success') {
        updateButtonState();
        
        // Update the button visual state
        actionButton.classList.add('clicked');
        setTimeout(() => {
          actionButton.classList.remove('clicked');
        }, 500);
        
        // Close the popup after a short delay
        setTimeout(() => {
          window.close();
        }, 300);
      }
    });
  });
  
  // Get data from storage
  chrome.storage.sync.get('lastClickTime', function(data) {
    if (data.lastClickTime) {
      const lastClick = new Date(data.lastClickTime);
      const infoElem = document.createElement('p');
      infoElem.className = 'info-text';
      infoElem.textContent = `Last action: ${lastClick.toLocaleString()}`;
      document.querySelector('.container').appendChild(infoElem);
    }
  });
});
