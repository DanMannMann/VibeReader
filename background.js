// Background script runs as a service worker in Manifest V3
chrome.runtime.onInstalled.addListener(function() {
  console.log('Extension installed');
  
  // Initialize storage with default values
  chrome.storage.sync.set({ 
    lastClickTime: null,
    counter: 0,
    overlayActive: false
  });
  
  // Create context menu items
  chrome.contextMenus.create({
    id: "openVibeReader",
    title: "Open Vibe Reader",
    contexts: ["page"]
  });
  
  chrome.contextMenus.create({
    id: "readWithVibeReader",
    title: "Read with Vibe Reader",
    contexts: ["selection"]
  });
  
  chrome.contextMenus.create({
    id: "readFromHere",
    title: "Start reading from here",
    contexts: ["all"]
  });
});

// Listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'buttonClicked') {
    // Update storage with current time
    const currentTime = new Date().getTime();
    chrome.storage.sync.set({ lastClickTime: currentTime });
    
    // Update counter
    chrome.storage.sync.get('counter', function(data) {
      const newCount = (data.counter || 0) + 1;
      chrome.storage.sync.set({ counter: newCount });
      
      console.log('Button clicked. Total clicks:', newCount);
    });
    
    // Send success response back to popup
    sendResponse({ status: 'success' });
    
    // Send message to active tab to toggle the overlay
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleOverlay' }, function(response) {
          if (response) {
            chrome.storage.sync.set({ overlayActive: response.overlayActive });
          }
        });
      }
    });
  }
    // Required for async sendResponse
  return true;
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "openVibeReader") {
    // Send message to the active tab to open the reader
    chrome.tabs.sendMessage(tab.id, { action: 'toggleOverlay' }, function(response) {
      if (response) {
        chrome.storage.sync.set({ overlayActive: response.overlayActive });
      }
    });
  } else if (info.menuItemId === "readWithVibeReader") {
    // Send message to read the selected text
    chrome.tabs.sendMessage(tab.id, { 
      action: 'toggleOverlay',
      useSelection: true
    }, function(response) {
      if (response) {
        chrome.storage.sync.set({ overlayActive: response.overlayActive });
      }
    });  } else if (info.menuItemId === "readFromHere") {
    // Send message to start reading from the clicked position
    chrome.tabs.sendMessage(tab.id, { 
      action: 'toggleOverlay',
      startFromClick: true,
      targetElementInfo: {
        nodeName: info.targetNodeName,
        linkUrl: info.linkUrl,
        srcUrl: info.srcUrl,
        pageUrl: info.pageUrl,
        frameId: info.frameId,
        frameUrl: info.frameUrl,
        selectionText: info.selectionText,
        mediaType: info.mediaType
      }
    }, function(response) {
      if (response) {
        chrome.storage.sync.set({ overlayActive: response.overlayActive });
      }
    });
  }
});
