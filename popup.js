// S.A.G.E. Popup Settings Logic - File-based configuration

document.addEventListener('DOMContentLoaded', async () => {
  // Load and display config status
  await loadConfigStatus();
  
  // Load saved preferences
  await loadSettings();
  
  // Setup event listeners
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('reloadBtn').addEventListener('click', reloadConfig);
  
  // Update stats
  updateStats();
});

async function loadConfigStatus() {
  try {
    const result = await chrome.storage.local.get(['groqApiKey', 'userProfile']);
    
    // Check API key status
    const apiKeyEl = document.getElementById('apiKeyStatus');
    if (result.groqApiKey) {
      apiKeyEl.textContent = '✓ Loaded';
      apiKeyEl.className = 'config-value loaded';
    } else {
      apiKeyEl.textContent = '✗ Missing';
      apiKeyEl.className = 'config-value missing';
    }
    
    // Check Summary status and display preview
    const summaryEl = document.getElementById('summaryStatus');
    const previewEl = document.getElementById('stylePreview');
    
    if (result.userProfile && result.userProfile.bio) {
      summaryEl.textContent = '✓ Loaded';
      summaryEl.className = 'config-value loaded';
      previewEl.textContent = result.userProfile.bio;
    } else {
      summaryEl.textContent = '✗ Missing';
      summaryEl.className = 'config-value missing';
      previewEl.textContent = 'No writing style loaded. Add Summary.txt to your extension folder.';
    }
    
  } catch (error) {
    console.error('Failed to load config status:', error);
  }
}

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['stylePreferences']);

    // Load style preferences
    if (result.stylePreferences) {
      const prefs = result.stylePreferences;
      
      // Set tone
      if (prefs.tone) {
        const toneRadio = document.getElementById(`tone-${prefs.tone}`);
        if (toneRadio) toneRadio.checked = true;
      }
      
      // Set length
      if (prefs.length) {
        const lengthRadio = document.getElementById(`length-${prefs.length}`);
        if (lengthRadio) lengthRadio.checked = true;
      }
    }

  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatus('Failed to load settings', 'error');
  }
}

async function saveSettings() {
  try {
    // Get selected tone
    const toneRadios = document.getElementsByName('tone');
    let tone = 'balanced';
    for (const radio of toneRadios) {
      if (radio.checked) {
        tone = radio.value;
        break;
      }
    }

    // Get selected length
    const lengthRadios = document.getElementsByName('length');
    let length = 'medium';
    for (const radio of lengthRadios) {
      if (radio.checked) {
        length = radio.value;
        break;
      }
    }

    // Save preferences
    await chrome.storage.local.set({
      stylePreferences: { tone, length }
    });

    showStatus('✨ Preferences saved successfully!', 'success');
    
    // Update stats after saving
    setTimeout(updateStats, 500);

  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('Failed to save settings: ' + error.message, 'error');
  }
}

async function reloadConfig() {
  try {
    showStatus('🔄 Reloading configuration files...', 'info');
    
    // Send message to background script to reload
    chrome.runtime.sendMessage({ action: 'reloadConfig' }, async (response) => {
      if (response && response.success) {
        showStatus('✅ Configuration reloaded successfully!', 'success');
        
        // Refresh the display
        await loadConfigStatus();
        await loadSettings();
        updateStats();
      } else {
        showStatus('❌ Failed to reload configuration', 'error');
      }
    });
    
  } catch (error) {
    console.error('Failed to reload config:', error);
    showStatus('Failed to reload: ' + error.message, 'error');
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  
  if (type === 'success') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}

async function updateStats() {
  try {
    const result = await chrome.storage.local.get(['usageStats']);
    const stats = result.usageStats || { totalReplies: 0, lastReset: Date.now() };
    
    // Check if hour has passed
    const hourInMs = 3600000;
    if (Date.now() - stats.lastReset > hourInMs) {
      stats.currentHourReplies = 0;
      stats.lastReset = Date.now();
      await chrome.storage.local.set({ usageStats: stats });
    }

    document.getElementById('repliesCount').textContent = stats.totalReplies || 0;
    document.getElementById('repliesRemaining').textContent = Math.max(0, 20 - (stats.currentHourReplies || 0));

  } catch (error) {
    console.error('Failed to update stats:', error);
  }
}