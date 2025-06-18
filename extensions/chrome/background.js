// Track active tabs to prevent multiple injections
const activeTabs = new Set();

// Handle extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  await toggleSpacingJS(tab);
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'toggle_spacing' && tab) {
    await toggleSpacingJS(tab);
  }
});

// Main function to toggle SpacingJS
async function toggleSpacingJS(tab) {
  if (!tab || !tab.id) {
    console.error('Invalid tab provided');
    return;
  }

  try {
    // Check if we can access the tab
    if (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:')
    ) {
      // Show notification for restricted pages
      chrome.action.setBadgeText({
        text: '!',
        tabId: tab.id,
      });
      chrome.action.setBadgeBackgroundColor({
        color: '#ff4444',
        tabId: tab.id,
      });

      // Clear badge after 3 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({
          text: '',
          tabId: tab.id,
        });
      }, 3000);

      console.warn('SpacingJS cannot run on browser internal pages');
      return;
    }

    const tabId = tab.id;

    if (activeTabs.has(tabId)) {
      // SpacingJS is active, deactivate it
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          if (window.Spacing && window.Spacing.stop) {
            window.Spacing.stop();
            window.spacingJSActive = false;
          }
        },
      });

      activeTabs.delete(tabId);

      // Update badge to show inactive state
      chrome.action.setBadgeText({
        text: '',
        tabId,
      });

      chrome.action.setTitle({
        title: 'SpacingJS - Click to activate',
        tabId,
      });
    } else {
      // SpacingJS is not active, activate it
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['spacing.min.js'],
      });

      // Initialize SpacingJS
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          if (window.Spacing && window.Spacing.start) {
            window.Spacing.start();
            window.spacingJSActive = true;
          }
        },
      });

      activeTabs.add(tabId);

      // Update badge to show active state
      chrome.action.setBadgeText({
        text: '●',
        tabId,
      });
      chrome.action.setBadgeBackgroundColor({
        color: '#4CAF50',
        tabId,
      });

      chrome.action.setTitle({
        title: 'SpacingJS - Active (click to deactivate)',
        tabId,
      });
    }
  } catch (error) {
    console.error('Error toggling SpacingJS:', error);

    // Show error badge
    chrome.action.setBadgeText({
      text: '!',
      tabId: tab.id,
    });
    chrome.action.setBadgeBackgroundColor({
      color: '#ff4444',
      tabId: tab.id,
    });

    // Clear error badge after 3 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({
        text: '',
        tabId: tab.id,
      });
    }, 3000);
  }
}

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

// Clean up when tabs are updated (e.g., navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    activeTabs.delete(tabId);
    chrome.action.setBadgeText({
      text: '',
      tabId,
    });
    chrome.action.setTitle({
      title: 'SpacingJS - Click to activate',
      tabId,
    });
  }
});
