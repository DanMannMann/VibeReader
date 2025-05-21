// Content script runs in the context of web pages
console.log('Content script loaded');

// Create a variable to track overlay state
let overlayActive = false;
let overlayElement = null;

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
let isDraggingProgress = false; // Track if user is dragging the scrollbar

// Create the overlay element
function createOverlay() {
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
    <h2 style="text-align: center; margin-bottom: 20px; color: #202124;">Speed Reader</h2>
    <div id="controls" style="margin-bottom: 20px;">
      <div style="margin-bottom: 15px; display: flex; flex-wrap: nowrap; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; flex: 3;">
          <label style="margin-right: 10px; white-space: nowrap;">Speed(WPM): <input type="text" value="500" size="4" id="speedInput" style="padding: 5px; width: 50px;"></label>
          <label style="margin-right: 10px; white-space: nowrap;">Pause for full stop: <input type="text" value="1.5" size="4" id="fullStopInput" style="padding: 5px; width: 50px;"></label>
          <label style="white-space: nowrap;">Pause for comma: <input type="text" value="0.5" size="4" id="commaInput" style="padding: 5px; width: 50px;"></label>
        </div>
        <div style="display: flex; align-items: center; flex: 1; justify-content: flex-end;">
          <input type="button" value="Start" id="startButton" style="margin-right: 10px; padding: 8px 16px; background-color: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;"/>
          <input type="button" value="Pause" id="pauseResumeButton" style="padding: 8px 16px; background-color: #ea4335; color: white; border: none; border-radius: 4px; cursor: pointer;"/>
        </div>
      </div>
      <div id="readingArea" style="border: 1px solid #e0e0e0; min-height: 80px; padding: 10px; margin-top: 10px; display: flex; flex-direction: column; align-items: center;">
        <div id="canvasContainer" style="width: 100%; display: flex; justify-content: center;"></div>
        <div id="progressContainer" style="width: 95%; margin-top: 10px; display: flex; align-items: center;">
          <input type="range" id="readingProgress" min="0" max="100" value="0" style="width: 100%; height: 10px;">
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
  if (overlayElement && overlayElement.parentNode) {
    // Stop any ongoing reading
    stopf();
    
    // Remove wheel event listener
    document.removeEventListener('wheel', preventScrolling, { passive: false, capture: true });
    
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
    readingProgress = null;
    extractedWords = [];
    isDraggingProgress = false;
    isPaused = false;
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
function initSpeedReader() {
  // Get references to all the input elements
  speedInput = document.getElementById("speedInput");
  fullStopInput = document.getElementById("fullStopInput");
  commaInput = document.getElementById("commaInput");
  startButton = document.getElementById("startButton");
  pauseResumeButton = document.getElementById("pauseResumeButton");
  readingProgress = document.getElementById("readingProgress");
  
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
      // Display current word without starting reading
      displayWordAtPosition(newPosition);
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



// Implementing the TODO: Extract text from the current page
function extractPageText() {
  // Get all text nodes from the body
  const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, span, div');
  let text = '';
  
  // Extract text from each element
  textElements.forEach(element => {
    // Skip hidden elements and elements inside our overlay
    if (element.offsetParent !== null && !overlayElement.contains(element)) {
      const elementText = element.innerText || element.textContent;
      if (elementText && elementText.trim()) {
        text += elementText + ' ';
      }
    }
  });
  
  // Clean up the text and split into words
  const words = text
    .replace(/[\r\n]+/g, ' ') // Replace line breaks with spaces
    .replace(/\s+/g, ' ')     // Normalize spaces
    .trim()                   // Remove leading/trailing spaces
    .split(/\s+/);            // Split into words
  
  // Store the extracted words for navigation
  extractedWords = words;
  
  return words;
}

// Start function with implemented TODO
function start() {
  // Extract words from the page content
  const words = extractPageText();
  
  // If no words were found, show a message
  if (words.length === 0) {
    alert("No readable text found on the page.");
    return;
  }
  
  stopf();
  speedA = 60000 / speedInput.value;
  currentCounter = 0;
  
  // Reset the progress slider
  if (readingProgress) {
    readingProgress.value = 0;
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


