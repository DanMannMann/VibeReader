# Vibe Reader Chrome Extension

A speed reading Chrome extension that enhances your reading experience with a clean, focused interface.

## Structure

- `manifest.json`: Configuration file for the extension
- `popup.html/js/css`: Files for the extension popup UI
- `background.js`: Background script that runs independently
- `content.js`: Script that runs in the context of web pages
- `images/`: Directory for extension icons

## Features

- Translucent overlay with blur effect that can be toggled on any web page
- The overlay creates a "frosted glass" effect over the entire page content
- Built-in Vibe Reader that helps you read page content faster
- Automatically extracts and processes text from the current page
- Configurable reading speed (WPM) and pause timings for punctuation
- Context menu integration for easy access from any page
- Read selected text by right-clicking on a selection
- Start reading from any position by right-clicking and selecting "Start reading from here"
- Auto-scrolling feature that can be toggled on/off

## Icon Requirements

You'll need to add icon files in the `images/` directory:

- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

## Installation for Development

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by toggling the switch in the top right corner
3. Click "Load unpacked" and select the extension directory
4. The extension should now be installed and ready for testing

## Usage

- Click on the extension icon in the Chrome toolbar to open the popup interface
- Right-click anywhere on a page and select "Open Vibe Reader" to start reading from the beginning
- Right-click on a text selection and choose "Read with Vibe Reader" to read only the selected text
- Right-click anywhere on the page and select "Start reading from here" to begin reading from that position
- Use the checkbox in the overlay to toggle auto-scrolling on/off

## Features

- Popup UI with HTML, CSS, and JavaScript
- Background service worker for background tasks
- Content script for interacting with web pages
- Chrome storage for persistent data
- Communication between different parts of the extension

## License

MIT
