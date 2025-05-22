// Content script runs in the context of web pages
console.log('Content script loaded');

// Create a variable to track overlay state
let overlayActive = false;
let overlayElement = null;
let lastHighlightedElement = null; // Keep track of the last highlighted element
let userSelection = null; // Track user's text selection when overlay is opened

// Variables for speed reader
let speedReaderCanvas;
let speedReaderCtx;
let speedA = 120;
let stop = false;
let currentlyPrinting = false;
let isPaused = false;  // Track if reading is paused
let currentCounter = 0;
let speedInput;
let fullStopInput;
let commaInput;
let startButton;
let pauseResumeButton;  // Renamed from stopButton
let readingProgress;
let extractedWords = []; // Store extracted words for navigation
let extractedWordElements = []; // Store the source elements for each word
let isDraggingProgress = false; // Track if user is dragging the scrollbar
let autoScroll = true; // Track if auto-scrolling is enabled

// Create the overlay element
function createOverlay() {
  // Capture user selection before creating overlay
  userSelection = window.getSelection();
  
  // Create overlay div
  overlayElement = document.createElement('div');
  overlayElement.id = 'chrome-extension-overlay';
  overlayElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    transition: opacity 0.3s ease;
    pointer-events: auto;
    padding: 20px;
  `;
  
  // Create the reader container
  const readerContainer = document.createElement('div');
  readerContainer.style.cssText = `
    background-color: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    width: 80%;
    max-width: 800px;
    margin-bottom: 20px;
  `;
    // Add the HTML content from example.html
  readerContainer.innerHTML = `
    <h2 style="text-align: center; margin-bottom: 20px; color: #202124;">Vibe Reader</h2>
    <div id="controls" style="margin-bottom: 20px;">      <div style="margin-bottom: 15px; display: flex; flex-wrap: nowrap; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; flex: 3;">          <label style="margin-right: 10px; white-space: nowrap;">Speed(WPM): <input type="text" value="500" size="4" id="speedInput" style="padding: 5px; width: 50px;"></label>
          <label style="margin-right: 10px; white-space: nowrap;">Pause for full stop: <input type="text" value="1.5" size="4" id="fullStopInput" style="padding: 5px; width: 50px;"></label>
          <label style="margin-right: 10px; white-space: nowrap;">Pause for comma: <input type="text" value="0.5" size="4" id="commaInput" style="padding: 5px; width: 50px;"></label>
        </div>
        <div style="display: flex; align-items: center; flex: 1; justify-content: flex-end;">
          <input type="button" value="Start" id="startButton" style="margin-right: 10px; padding: 8px 16px; background-color: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;"/>
          <input type="button" value="Pause" id="pauseResumeButton" style="padding: 8px 16px; background-color: #ea4335; color: white; border: none; border-radius: 4px; cursor: pointer;"/>
        </div>
      </div>      <div id="readingArea" style="border: 1px solid #e0e0e0; min-height: 80px; padding: 10px; margin-top: 10px; display: flex; flex-direction: column; align-items: center;">
        <div id="canvasContainer" style="width: 100%; display: flex; justify-content: center;"></div>
        <div id="progressContainer" style="width: 95%; margin-top: 10px; display: flex; align-items: center;">
          <input type="range" id="readingProgress" min="0" max="100" value="0" style="width: 100%; height: 10px;">
        </div>
        <div style="width: 95%; margin-top: 5px; display: flex; justify-content: flex-end;">
          <label style="white-space: nowrap; font-size: 14px;"><input type="checkbox" id="autoScrollCheckbox" checked style="margin-right: 5px;">Auto-scroll</label>
        </div>
      </div>
    </div>
  `;
  
  overlayElement.appendChild(readerContainer);
  
  // Create a close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close Reader';
  closeButton.style.cssText = `
    padding: 10px 20px;
    background-color: #4285f4;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    transition: transform 0.2s ease, background-color 0.2s ease;
  `;
  
  closeButton.addEventListener('mouseover', function() {
    this.style.backgroundColor = '#3367d6';
  });
  
  closeButton.addEventListener('mouseout', function() {
    this.style.backgroundColor = '#4285f4';
  });
  
  closeButton.addEventListener('mousedown', function() {
    this.style.transform = 'scale(0.95)';
  });
    closeButton.addEventListener('mouseup', function() {
    this.style.transform = 'scale(1)';
  });
  
  // Add click event to remove overlay
  closeButton.addEventListener('click', removeOverlay);
  overlayElement.appendChild(closeButton);
  
  // Add overlay to page
  document.body.appendChild(overlayElement);
  overlayActive = true;
  
  // Add wheel event listener for speed control
  document.addEventListener('wheel', preventScrolling, { passive: false, capture: true });
  
  // Initialize the speed reader functionality
  initSpeedReader();
  
  // Start reading immediately
  startOrRestart();
}

// Remove the overlay
function removeOverlay() {
  if (overlayElement && overlayElement.parentNode) {    // Stop any ongoing reading
    stopf();
    
    // Remove wheel event listener
    document.removeEventListener('wheel', preventScrolling, { passive: false, capture: true });
    
    // Clear any element highlighting
    clearAllHighlights();
    
    // Reset variables
    currentCounter = 0;
    currentlyPrinting = false;
    stop = false;
    
    // Remove the overlay from the DOM
    overlayElement.parentNode.removeChild(overlayElement);
    overlayElement = null;
    overlayActive = false;
    
    // Reset references
    speedReaderCanvas = null;
    speedReaderCtx = null;
    speedInput = null;
    fullStopInput = null;
    commaInput = null;
    startButton = null;
    pauseResumeButton = null;
    readingProgress = null;    extractedWords = [];
    extractedWordElements = [];
    isDraggingProgress = false;
    isPaused = false;
    autoScroll = true; // Reset auto-scroll to default (enabled)
    userSelection = null; // Clear the selection reference
    
    // Clear all highlights
    clearAllHighlights();
  }
}

// Toggle the overlay
function toggleOverlay() {
  if (overlayActive) {
    removeOverlay();
  } else {
    createOverlay();
  }
}

// Initialize speed reader functionality
function initSpeedReader() {  // Get references to all the input elements
  speedInput = document.getElementById("speedInput");
  fullStopInput = document.getElementById("fullStopInput");
  commaInput = document.getElementById("commaInput");
  startButton = document.getElementById("startButton");
  pauseResumeButton = document.getElementById("pauseResumeButton");
  readingProgress = document.getElementById("readingProgress");
  const autoScrollCheckbox = document.getElementById("autoScrollCheckbox");
  
  // Initialize auto-scroll checkbox and add event listener
  if (autoScrollCheckbox) {
    autoScrollCheckbox.checked = autoScroll;
    autoScrollCheckbox.addEventListener('change', function() {
      autoScroll = this.checked;
    });
  }
  
  // Create canvas for speed reader
  speedReaderCanvas = document.createElement("canvas");
  speedReaderCtx = speedReaderCanvas.getContext("2d");
  
  // Set canvas dimensions
  speedReaderCanvas.width = 350;
  speedReaderCanvas.height = 70;
  speedReaderCtx.fillStyle = "#000000";
  
  // Add canvas to the canvas container
  document.getElementById("canvasContainer").appendChild(speedReaderCanvas);
  
  // Draw the lines on canvas
  speedReaderCtx.moveTo(10, 10);
  speedReaderCtx.lineTo(340, 10);
  speedReaderCtx.stroke();
  speedReaderCtx.moveTo(10, 60);
  speedReaderCtx.lineTo(340, 60);
  speedReaderCtx.stroke();
  speedReaderCtx.moveTo(170, 10);
  speedReaderCtx.lineTo(170, 15);
  speedReaderCtx.stroke();
  speedReaderCtx.moveTo(170, 60);
  speedReaderCtx.lineTo(170, 55);
  speedReaderCtx.stroke();
  speedReaderCtx.font = "25px Georgia";
  
  // Add event listeners to buttons
  startButton.addEventListener('click', startOrRestart);
  pauseResumeButton.addEventListener('click', togglePauseResume);
    // Add event listeners for the scrollbar
  readingProgress.addEventListener('mousedown', function() {
    isDraggingProgress = true;
    // Stop reading if currently in progress
    if (currentlyPrinting) {
      stopf();
    }
  });
    readingProgress.addEventListener('input', function() {
    if (extractedWords.length > 0) {
      // Only update position display while dragging, without starting reading
      const newPosition = Math.floor((readingProgress.value / 100) * extractedWords.length);
      
      // Store the current position temporarily to allow smooth scrolling
      // during manual progress bar interaction
      const previousCounter = currentCounter;
      currentCounter = newPosition;
      
      // Display current word without starting reading
      displayWordAtPosition(newPosition);
      
    // Also scroll to the corresponding element to sync the page position
      if (extractedWordElements && extractedWordElements[newPosition]) {
        // When dragging the progress bar, we want to calculate the exact position within the element
        // based on the word's position in the element's content
        const currentElement = extractedWordElements[newPosition];
        
        // Calculate the exact position for smooth progression
        scrollToElement(currentElement);
      }
      
      // Restore the counter if we're not actually changing the reading position yet
      // (this happens on mouseup)
      if (isDraggingProgress) {
        currentCounter = previousCounter;
      }
    }
  });
  
  readingProgress.addEventListener('mouseup', function() {
    if (extractedWords.length > 0) {
      // Now that user released the scrollbar, update position
      const newPosition = Math.floor((readingProgress.value / 100) * extractedWords.length);
      currentCounter = newPosition;
      isDraggingProgress = false;
      
      // Immediately resume reading from the new position if we weren't in a paused state
      if (!currentlyPrinting && !isPaused) {
        speedA = 60000 / speedInput.value;
        delayPrintWord(extractedWords);
        
        // Since reading starts, update button text
        startButton.value = "Restart";
      }
    }
  });
}

// Word separator function from example.js
function wordSeparator(word) {
  var len = word.length,
      orpIndex = Math.floor(Math.floor((len + 1) / 2)) - 1,
      left = word.substring(0, orpIndex),
      orp = word.substring(orpIndex, orpIndex + 1),
      right = word.substring(orpIndex + 1, len),
      result = new Array();
  result[0] = left;
  result[1] = orp;
  result[2] = right;
  return result;
}

// Delay print word function from example.js
function delayPrintWord(words) {
  var extraDelay = 0;
  currentlyPrinting = true;
  var splitWord = wordSeparator(words[currentCounter]);
  if (
    words[currentCounter].indexOf(".") != -1 ||
    words[currentCounter].indexOf("?") != -1
  ) {
    extraDelay += speedA * fullStopInput.value;
  } else {
    if (words[currentCounter].indexOf(",") != -1) {
      extraDelay += speedA * commaInput.value;
    }
  }
  var sizeORP = speedReaderCtx.measureText(splitWord[1]).width;
  var sizeLeft = speedReaderCtx.measureText(splitWord[0]).width;
  var sizeRight = speedReaderCtx.measureText(splitWord[2]).width;
  speedReaderCtx.clearRect(15, 15, 335, 40);
  speedReaderCtx.fillStyle = "#FF0000";
  speedReaderCtx.fillText(splitWord[1], 170 - sizeORP / 2, 45);
  speedReaderCtx.fillStyle = "#000000";
  speedReaderCtx.fillText(splitWord[0], 170 - sizeORP / 2 - sizeLeft, 45);
  speedReaderCtx.fillText(splitWord[2], 170 + sizeORP / 2, 45);
    // Update scrollbar position only if user is not currently dragging it
  if (!isDraggingProgress && readingProgress) {
    const progressPercentage = Math.floor((currentCounter / words.length) * 100);
    readingProgress.value = progressPercentage;
  }
    // Always highlight the current element regardless of auto-scroll setting
  if (extractedWordElements && extractedWordElements[currentCounter]) {
    highlightCurrentElement(extractedWordElements[currentCounter]);
    
    // Scroll the page to the current element if auto-scroll is enabled
    scrollToElement(extractedWordElements[currentCounter]);
  }
  
  currentCounter = currentCounter + 1;
  if (currentCounter >= words.length || stop == true) {
    stop = false;
    currentlyPrinting = false;
    return;
  } else {
    setTimeout(function () {
      delayPrintWord(words);
    }, speedA + extraDelay);
    return;
  }
}



// Extract text from the current page or from user selection
function extractPageText() {
  // Reset the arrays
  extractedWords = [];
  extractedWordElements = [];
    // Check if we have a valid user selection
  if (userSelection && !userSelection.isCollapsed && userSelection.toString().trim()) {
    // Process selected text
    const selectedText = userSelection.toString().trim();
    
    // If there's only selected text, use that
    if (selectedText) {
      console.log('Reading from selection:', selectedText);
      
      // Get the range information
      const range = userSelection.getRangeAt(0);
      const selectionContainer = range.commonAncestorContainer;
      
      // Get parent element if the selection is just a text node
      const containerElement = selectionContainer.nodeType === 3 ? 
                              selectionContainer.parentElement : selectionContainer;
      
      // Split the selected text into words
      const selectedWords = selectedText
        .replace(/[\r\n]+/g, ' ') // Replace line breaks with spaces
        .replace(/\s+/g, ' ')     // Normalize spaces
        .trim()                   // Remove leading/trailing spaces
        .split(/\s+/);            // Split into words
      
      // Handle the case where selection crosses multiple elements
      if (selectedWords.length > 0) {
        // If the selection is inside a single element, use that for all words
        if (range.startContainer === range.endContainer || 
            (range.startContainer.parentNode === range.endContainer.parentNode)) {
          
          // Add selected words to our arrays with the same container
          selectedWords.forEach(word => {
            extractedWords.push(word);
            extractedWordElements.push(containerElement);
          });
        } else {
          // For selections spanning multiple elements, we need to find each element
          // This is a simplified approach that might not be perfect for all cases
          const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, span, div');
          let elementsInRange = [];
          
          // Find elements that are within or intersect with our selection range
          textElements.forEach(element => {
            if (!overlayElement.contains(element) && 
                element.offsetParent !== null &&
                range.intersectsNode(element)) {
              elementsInRange.push(element);
            }
          });
          
          // If we found elements in range, distribute words among them
          if (elementsInRange.length > 0) {
            let wordIndex = 0;
            const wordsPerElement = Math.ceil(selectedWords.length / elementsInRange.length);
            
            elementsInRange.forEach(element => {
              const elementWordCount = Math.min(wordsPerElement, selectedWords.length - wordIndex);
              
              for (let i = 0; i < elementWordCount && wordIndex < selectedWords.length; i++) {
                extractedWords.push(selectedWords[wordIndex]);
                extractedWordElements.push(element);
                wordIndex++;
              }
            });
          } else {
            // Fallback to using the common ancestor
            selectedWords.forEach(word => {
              extractedWords.push(word);
              extractedWordElements.push(containerElement);
            });
          }
        }
      }
      
      return extractedWords;
    }
  }
  
  // If no valid selection, extract text from the whole page
  const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, span, div');
  let text = '';
  
  // Extract text from each element
  textElements.forEach(element => {
    // Skip hidden elements and elements inside our overlay
    if (element.offsetParent !== null && !overlayElement.contains(element)) {
      const elementText = element.innerText || element.textContent;
      if (elementText && elementText.trim()) {
        // Split the element's text into words
        const elementWords = elementText
          .replace(/[\r\n]+/g, ' ') // Replace line breaks with spaces
          .replace(/\s+/g, ' ')     // Normalize spaces
          .trim()                   // Remove leading/trailing spaces
          .split(/\s+/);            // Split into words
          
        // Add each word to our arrays, tracking its source element
        elementWords.forEach(word => {
          extractedWords.push(word);
          extractedWordElements.push(element);
        });
        
        // Add a space between elements
        text += elementText + ' ';
      }
    }
  });
  
  return extractedWords;
}

// Start function with implemented TODO
function start() {
  // Extract words from the page content or selection
  const words = extractPageText();
  
  // If no words were found, show a message
  if (words.length === 0) {
    alert("No readable text found on the page.");
    return;
  }
  
  stopf();
  speedA = 60000 / speedInput.value;
  
  // Set the starting position
  currentCounter = 0;
    // If we're using the full page text but have a selection, find and start from that selection
  if (userSelection && !userSelection.isCollapsed && userSelection.toString().trim()) {
    const selectedText = userSelection.toString().trim();
    
    // If we're not reading only the selection (i.e., using the full page text)
    // Find where in the full text our selection begins
    if (words.length > selectedText.split(/\s+/).length) {
      const firstSelectedWord = selectedText.split(/\s+/)[0];
      
      // Try to find the index of the first selected word
      let startIndex = -1;
      
      // First attempt: exact match
      startIndex = words.findIndex(word => 
        word.toLowerCase().replace(/[^\w]/g, '') === 
        firstSelectedWord.toLowerCase().replace(/[^\w]/g, '')
      );
      
      // Second attempt: partial match (for cases where selection starts mid-word)
      if (startIndex === -1) {
        for (let i = 0; i < words.length; i++) {
          if (doesSelectionContainWord(userSelection, words[i])) {
            startIndex = i;
            break;
          }
        }
      }
      
      // Third attempt: look for consecutive words from the selection
      if (startIndex === -1 && selectedText.split(/\s+/).length > 1) {
        const firstTwoWords = selectedText.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
        
        for (let i = 0; i < words.length - 1; i++) {
          const twoWordsFromText = (words[i] + ' ' + words[i+1]).toLowerCase();
          if (twoWordsFromText.includes(firstTwoWords) || firstTwoWords.includes(twoWordsFromText)) {
            startIndex = i;
            break;
          }
        }
      }
      
      if (startIndex !== -1) {
        console.log(`Starting from selected word at index ${startIndex}: "${words[startIndex]}"`);
        currentCounter = startIndex;
      }
    }
  }
    // Update the progress slider to reflect the starting position
  if (readingProgress) {
    const progressPercentage = Math.floor((currentCounter / words.length) * 100);
    readingProgress.value = progressPercentage;
  }
  
  // If we're reading a selection only, update the UI to reflect this
  if (userSelection && !userSelection.isCollapsed && words.length === userSelection.toString().trim().split(/\s+/).length) {
    // Change the start button label to indicate we're reading a selection
    if (startButton) {
      startButton.value = "Read Selection";
    }
  }
  
  delayPrintWord(words);
}

// Stop function
function stopf() {
  if (currentlyPrinting) {
    stop = true;
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'backgroundNotification') {
    console.log('Received notification from background script');
    
    // You can manipulate the DOM of the current page here
    const notificationDiv = document.createElement('div');
    notificationDiv.textContent = 'Action performed by extension!';
    notificationDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 15px;
      background-color: #4285f4;
      color: white;
      border-radius: 4px;
      z-index: 9999;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(notificationDiv);
    
    // Remove the notification after 3 seconds
    setTimeout(() => {
      if (notificationDiv && notificationDiv.parentNode) {
        notificationDiv.parentNode.removeChild(notificationDiv);
      }
    }, 3000);
  }
    if (request.action === 'toggleOverlay') {
    // If request comes from context menu selection
    if (request.useSelection && !overlayActive) {
      // Capture the current selection before opening the overlay
      userSelection = window.getSelection();
    }
      // If request comes from right-click "Start reading from here"
    if (request.startFromClick && !overlayActive) {
      // Create a custom selection based on the clicked element information
      createSelectionFromClick(request.targetElementInfo);
    }
    
    toggleOverlay();
    sendResponse({ status: 'success', overlayActive });
  }
});
console.log('DEBUGGING OVERLAY ACTIVATION');

// Function to prevent scrolling on the page when overlay is active
function preventScrolling(event) {
  // Only prevent scrolling if our overlay is active
  if (overlayActive) {
    event.preventDefault();
    event.stopPropagation();
    
    // Only adjust speed if the input elements are initialized
    if (speedInput) {
      console.log('Scroll detected: ', event.deltaY);
      
      // Get the current speed value
      const currentSpeed = parseInt(speedInput.value) || 500;
      
      // Calculate new speed based on scroll direction
      // Scrolling up (negative deltaY) increases speed, scrolling down decreases it
      let newSpeed = currentSpeed;
      
      // Adjust speed by 10 WPM per scroll step
      if (event.deltaY < 0) {
        // Scrolling up - increase speed
        newSpeed = Math.min(currentSpeed + 10, 1000); // Cap at 1000 WPM
        console.log('Increasing speed to: ', newSpeed);
      } else {
        // Scrolling down - decrease speed
        newSpeed = Math.max(currentSpeed - 10, 100); // Minimum 100 WPM
        console.log('Decreasing speed to: ', newSpeed);
      }
      
      // Update the speed input
      speedInput.value = newSpeed;
      
      // If currently reading, update the speed in real-time
      if (currentlyPrinting) {
        speedA = 60000 / newSpeed;
      }
      
      // Show a visual feedback for speed change
      showSpeedChangeNotification(newSpeed);
    }
    
    return false;
  }
}

// Function to show a visual notification when speed changes
function showSpeedChangeNotification(speed) {
  // Create or get the notification element
  let notification = document.getElementById('speed-change-notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'speed-change-notification';
    notification.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background-color: rgba(66, 133, 244, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-weight: bold;
      transition: opacity 0.3s ease;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    overlayElement.appendChild(notification);
  }
  
  // Update the content and show the notification
  notification.textContent = `Speed: ${speed} WPM`;
  notification.style.opacity = '1';
  
  // Hide after a short delay
  clearTimeout(notification.timeout);
  notification.timeout = setTimeout(() => {
    notification.style.opacity = '0';
  }, 1000);
}

// Function to navigate to a specific position in the text
function navigateToPosition(position) {
  if (extractedWords && extractedWords.length > 0) {
    // Ensure position is within valid range
    position = Math.max(0, Math.min(position, extractedWords.length - 1));
    
    // Update current counter
    currentCounter = position;
    
    // Display the word at the position
    displayWordAtPosition(position);
  }
}

// Function to display a word at a specific position without starting reading
function displayWordAtPosition(position) {
  if (extractedWords && extractedWords.length > 0) {
    // Ensure position is within valid range
    position = Math.max(0, Math.min(position, extractedWords.length - 1));
    
    // Display the word without starting the reading
    speedReaderCtx.clearRect(15, 15, 335, 40);
    const splitWord = wordSeparator(extractedWords[position]);
    var sizeORP = speedReaderCtx.measureText(splitWord[1]).width;
    var sizeLeft = speedReaderCtx.measureText(splitWord[0]).width;
    var sizeRight = speedReaderCtx.measureText(splitWord[2]).width;
    
    speedReaderCtx.fillStyle = "#FF0000";
    speedReaderCtx.fillText(splitWord[1], 170 - sizeORP / 2, 45);
    speedReaderCtx.fillStyle = "#000000";
    speedReaderCtx.fillText(splitWord[0], 170 - sizeORP / 2 - sizeLeft, 45);
    speedReaderCtx.fillText(splitWord[2], 170 + sizeORP / 2, 45);
  }
}

// Function to handle start or restart based on current state
function startOrRestart() {
  // Clear any existing reading and reset to the beginning
  stopf();
  
  // If already reading, the button is functioning as "Restart"
  if (currentlyPrinting || isPaused) {
    startButton.value = "Start"; // Reset button text
    isPaused = false;
    pauseResumeButton.value = "Pause"; // Reset the pause button text
  }
  
  // Start reading from the beginning
  start();
  
  // Change button text to "Restart"
  startButton.value = "Restart";
}

// Function to toggle pause/resume reading
function togglePauseResume() {
  if (extractedWords && extractedWords.length > 0) {
    if (currentlyPrinting) {
      // If currently reading, pause it
      stopf();
      isPaused = true;
      pauseResumeButton.value = "Resume";
    } else if (isPaused) {
      // If paused, resume reading
      isPaused = false;
      pauseResumeButton.value = "Pause";
      // Resume from current position
      speedA = 60000 / speedInput.value;
      delayPrintWord(extractedWords);
    }
  }
}

// Function to determine optimal scroll behavior based on reading speed
function getOptimalScrollBehavior() {
  // If reading very fast (above 700 WPM), use 'auto' to avoid scroll lag
  // Otherwise use 'smooth' for better user experience
  const currentSpeed = parseInt(speedInput?.value || 500);
  return currentSpeed > 700 ? 'auto' : 'smooth';
}

// Function to scroll page to the element containing the current word
function scrollToElement(element) {
  if (!element || !overlayActive || !autoScroll) return;
  
  // Calculate the element's position
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  
  // Calculate the element's position relative to the page
  const elementTop = rect.top + scrollTop;
  const elementHeight = rect.height;
  const elementBottom = elementTop + elementHeight;
  
  // Calculate what percentage through the current element's words we are
  const elementFirstWordIndex = extractedWordElements.findIndex(el => el === element);
  if (elementFirstWordIndex === -1) return;
  
  // Find the last word index that belongs to this element
  let elementLastWordIndex = extractedWordElements.lastIndexOf(element);
  if (elementLastWordIndex === -1) return;
  
  // Calculate progress within this element (0 to 1)
  let progressThroughElement = 0;
  
  // Only calculate progress if there are multiple words in this element
  if (elementLastWordIndex > elementFirstWordIndex) {
    const wordsInElement = elementLastWordIndex - elementFirstWordIndex + 1;
    const currentWordInElement = currentCounter - elementFirstWordIndex;
    progressThroughElement = Math.max(0, Math.min(1, currentWordInElement / wordsInElement));
  }
  
  // Calculate a smooth scroll position that progresses from top to bottom of the element
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const baseOffset = windowHeight / 3; // Element starts 1/3 from the top
  
  // Calculate the scrolling range within the element
  const scrollRangeStart = elementTop - baseOffset; // Start with element at 1/3 from top
  const scrollRangeEnd = elementBottom - baseOffset; // End with element bottom at 1/3 from top
    // Calculate target position based on progress through the element
  const targetPosition = scrollRangeStart + (progressThroughElement * (scrollRangeEnd - scrollRangeStart));
  
  // Apply scrolling with optimal behavior based on reading speed
  window.scrollTo({
    top: targetPosition,
    behavior: getOptimalScrollBehavior()
  });
}

// Function to highlight the current element being read
function highlightCurrentElement(element) {
  // Remove highlight from previous element if it exists
  if (lastHighlightedElement && lastHighlightedElement !== element) {
    lastHighlightedElement.style.removeProperty('background-color');
    lastHighlightedElement.style.removeProperty('transition');
  }
  
  // If the element is the same, no need to highlight again
  if (element && element !== lastHighlightedElement) {
    // Store the original background color if not already stored
    if (!element.dataset.originalBackgroundColor) {
      element.dataset.originalBackgroundColor = window.getComputedStyle(element).backgroundColor;
    }
    
    // Apply a subtle highlight
    element.style.backgroundColor = 'rgba(66, 133, 244, 0.1)';
    element.style.transition = 'background-color 0.3s ease';
    
    // Update the last highlighted element
    lastHighlightedElement = element;
  }
}

// Function to clear all highlighting when removing the overlay
function clearAllHighlights() {
  if (lastHighlightedElement) {
    lastHighlightedElement.style.removeProperty('background-color');
    lastHighlightedElement.style.removeProperty('transition');
    lastHighlightedElement = null;
  }
}

// Helper function to check if a selection contains a specific word
function doesSelectionContainWord(selection, word) {
  if (!selection || selection.isCollapsed) return false;
  
  const selectionText = selection.toString().toLowerCase();
  const normalizedWord = word.toLowerCase().replace(/[^\w]/g, '');
  
  // Check for exact match
  if (selectionText.includes(word.toLowerCase())) return true;
  
  // Check for match without punctuation
  if (selectionText.replace(/[^\w\s]/g, '').includes(normalizedWord)) return true;
  
  // Check for partial match (beginning of selection might start mid-word)
  const words = selectionText.split(/\s+/);
  return words.some(w => 
    w.replace(/[^\w]/g, '').includes(normalizedWord) || 
    normalizedWord.includes(w.replace(/[^\w]/g, ''))
  );
}

// Function to create a selection from context menu click information
function createSelectionFromClick(targetInfo) {
  console.log("Creating selection from context menu click:", targetInfo);
  
  // Try to find a relevant element based on context menu info
  let element = null;
  
  // If there's a selection text, use the current selection
  if (targetInfo.selectionText) {
    console.log("Using existing selection text:", targetInfo.selectionText);
    userSelection = window.getSelection();
    return; // We already have a selection, no need to create one
  }
  
  // Look for elements that match our context info
  if (targetInfo.linkUrl) {
    // If clicked on a link, find the link element
    element = findElementByAttribute('a', 'href', targetInfo.linkUrl);
  } else if (targetInfo.srcUrl) {
    // If clicked on an image/media, find the media element
    element = findElementByAttribute('img,video,audio', 'src', targetInfo.srcUrl);
  }
  
  // If we still don't have an element, try to find a text element near the click
  if (!element || !element.innerText) {
    element = findTextElementAtPosition();
  }
  
  // If we found an element with text content
  if (element && (element.innerText || element.textContent)) {
    // Create a new range and selection
    const range = document.createRange();
    const sel = window.getSelection();
    
    // Use the clicked element as the starting point
    try {
      // Try to set the range to start at the beginning of the text node
      // closest to the click position
      const clickedNode = findTextNodeAtPoint(clientX, clientY, element);
      
      if (clickedNode) {
        // Try to find the word closest to the click
        const { node, offset } = findClosestWordToPoint(clickedNode, clientX, clientY);
        
        if (node) {
          // Set the range to encompass just the clicked word, if possible
          const wordBoundary = findWordBoundary(node, offset);
          
          if (wordBoundary) {
            range.setStart(node, wordBoundary.start);
            range.setEnd(node, wordBoundary.end);
          } else {
            // Fall back to selecting the entire text node
            range.selectNodeContents(node);
          }
          
          // Clear the current selection and add our new range
          sel.removeAllRanges();
          sel.addRange(range);
          
          // Store the selection
          userSelection = sel;
          console.log("Created selection from click:", sel.toString());
        } else {
          // If we couldn't get a precise word, select the entire element
          range.selectNodeContents(element);
          sel.removeAllRanges();
          sel.addRange(range);
          userSelection = sel;
        }
      } else {
        // Fall back to selecting the entire element
        range.selectNodeContents(element);
        sel.removeAllRanges();
        sel.addRange(range);
        userSelection = sel;
      }
    } catch (e) {
      console.error("Error creating selection from click:", e);
      
      // Fall back to selecting the entire element
      try {
        range.selectNodeContents(element);
        sel.removeAllRanges();
        sel.addRange(range);
        userSelection = sel;
      } catch (e2) {
        console.error("Fallback selection also failed:", e2);
      }
    }
  }
}

// Helper function to find a text node at a specific point
function findTextNodeAtPoint(x, y, element) {
  // Check if this element is a text node
  if (element.nodeType === Node.TEXT_NODE) {
    return element;
  }
  
  // Check all child nodes
  const children = element.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    
    // If this is a text node, it might be the one we want
    if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
      return child;
    }
    
    // If this is an element node, check if it contains the point
    if (child.nodeType === Node.ELEMENT_NODE) {
      const rect = child.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        // Recursively search this element
        const result = findTextNodeAtPoint(x, y, child);
        if (result) {
          return result;
        }
      }
    }
  }
  
  // If we reach here and this element has text content but no good child match,
  // return the first text node child
  for (let i = 0; i < children.length; i++) {
    if (children[i].nodeType === Node.TEXT_NODE && children[i].textContent.trim()) {
      return children[i];
    }
  }
  
  return null;
}

// Helper function to find the closest word to a point in a text node
function findClosestWordToPoint(textNode, x, y) {
  const range = document.createRange();
  const text = textNode.textContent;
  let bestDistance = Infinity;
  let bestOffset = 0;
  let bestNode = textNode;
  
  // Check each character position to find the one closest to the click
  for (let i = 0; i < text.length; i++) {
    try {
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);
      
      const rect = range.getBoundingClientRect();
      const distance = Math.sqrt(
        Math.pow(x - ((rect.left + rect.right) / 2), 2) + 
        Math.pow(y - ((rect.top + rect.bottom) / 2), 2)
      );
      
      if (distance < bestDistance) {
        bestDistance = distance;
        bestOffset = i;
        bestNode = textNode;
      }
    } catch (e) {
      // Skip any errors and continue
      continue;
    }
  }
  
  return { node: bestNode, offset: bestOffset };
}

// Helper function to find the start/end offsets of a word given a position within it
function findWordBoundary(textNode, offset) {
  const text = textNode.textContent;
  
  // If we're at the end, use the full text
  if (offset >= text.length) {
    return null;
  }
  
  // Move backwards to find the start of the word
  let start = offset;
  while (start > 0 && !/\s/.test(text[start - 1])) {
    start--;
  }
  
  // Move forwards to find the end of the word
  let end = offset;
  while (end < text.length && !/\s/.test(text[end])) {
    end++;
  }
  
  return { start, end };
}

// Helper function to find an element by its attribute value
function findElementByAttribute(selector, attribute, value) {
  if (!value) return null;
  
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    if (element.getAttribute(attribute) === value || element[attribute] === value) {
      return element;
    }
  }
  return null;
}

// Helper function to find a good text element to start reading from
function findTextElementAtPosition() {
  // Look for text elements with a reasonable amount of content
  const textElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, div, span'))
    .filter(el => {
      const text = el.innerText || el.textContent;
      return text && text.trim().length > 10 && el.offsetParent !== null; // Visible elements with enough text
    });
  
  if (textElements.length === 0) return null;
  
  // Try to find the first good paragraph element (likely to be content)
  const paragraphs = textElements.filter(el => el.tagName.toLowerCase() === 'p');
  if (paragraphs.length > 0) {
    return paragraphs[0];
  }
  
  // Otherwise return the first text element
  return textElements[0];
}


