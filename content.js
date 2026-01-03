// S.A.G.E. Content Script - FIXED for Twitter's actual DOM structure

class SAGEContentScript {
  constructor() {
    this.initialized = false;
    this.rateLimitCount = 0;
    this.rateLimitWindow = 3600000; // 1 hour
    this.maxRepliesPerHour = 20;
    this.activeComposer = null; // Track current composer
    
    this.init();
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    
    // Reset rate limit counter every hour
    setInterval(() => {
      this.rateLimitCount = 0;
    }, this.rateLimitWindow);
    
    // Watch for reply boxes appearing
    this.observeDOM();
    
    console.log('🌟 S.A.G.E. initialized - Watching for compose boxes...');
  }

  observeDOM() {
    console.log('🔍 [SAGE] Setting up tweet click listener...');
    
    // Listen for clicks on tweet articles
    document.addEventListener('click', (e) => {
      // Find the article element that was clicked
      let article = e.target.closest('article[data-testid="tweet"]');
      
      if (article) {
        console.log('🎯 [SAGE] Tweet clicked:', article);
        
        // Find the compose box for this tweet (usually appears on click)
        setTimeout(() => {
          const composer = document.querySelector('[data-testid="tweetTextarea_0RichTextInputContainer"]');
          if (composer) {
            console.log('✅ [SAGE] Compose box found after tweet click');
            this.activeComposer = composer;
            this.handleSageSpark(composer);
          } else {
            console.warn('⚠️ [SAGE] Compose box not found after tweet click');
          }
        }, 500);
      }
    }, true); // Use capture phase to catch clicks early
    
    console.log('✅ [SAGE] Tweet click listener activated');
  }

  // Removed: injectSageButtons and addSageButton methods
  // Now using direct click activation instead

  async handleSageSpark(composer) {
    console.log('🔥 [SAGE] Button clicked! Starting reply generation...');
    
    // Rate limiting check
    if (this.rateLimitCount >= this.maxRepliesPerHour) {
      console.warn(`⚠️ [SAGE] Rate limit reached: ${this.rateLimitCount}/${this.maxRepliesPerHour}`);
      this.showNotification('Rate limit reached. S.A.G.E. needs to rest! 🌙', 'warning');
      return;
    }

    // Get the Draft.js editor
    console.log('🔍 [SAGE] Looking for editor element...');
    const editor = composer.querySelector('[data-testid="tweetTextarea_0"]');
    if (!editor) {
      console.error('❌ [SAGE] Editor not found! Composer:', composer);
      this.showNotification('Could not find text editor', 'error');
      return;
    }
    console.log('✅ [SAGE] Editor found:', editor);

    // Get context
    console.log('📖 [SAGE] Extracting tweet context...');
    const tweetContext = this.extractTweetContext(composer);
    if (!tweetContext) {
      console.error('❌ [SAGE] Failed to extract context');
      this.showNotification('Could not extract tweet context', 'error');
      return;
    }

    console.log('📝 [SAGE] Context extracted:', tweetContext);

    // Show loading
    this.showNotification('✨ S.A.G.E. is crafting your reply...', 'loading');

    try {
      // Get user profile
      console.log('👤 [SAGE] Fetching user profile...');
      const userProfile = await this.getUserProfile();
      console.log('✅ [SAGE] User profile retrieved:', userProfile);
      
      // Generate reply
      console.log('🤖 [SAGE] Sending to background script for reply generation...');
      console.log('  - Context:', tweetContext);
      console.log('  - User Profile:', userProfile);
      
      const reply = await this.generateReply(tweetContext, userProfile);
      
      console.log('✅ [SAGE] Reply generated successfully!');
      console.log('  - Reply text:', reply);
      console.log('  - Length:', reply.length, 'characters');
      
      // Insert reply
      console.log('📄 [SAGE] Inserting reply into editor...');
      this.insertReply(editor, reply);
      
      this.rateLimitCount++;
      console.log(`✅ [SAGE] Rate limit updated: ${this.rateLimitCount}/${this.maxRepliesPerHour}`);
      this.showNotification('Reply generated! Edit and post 🎯', 'success');
      
    } catch (error) {
      console.error('❌ [SAGE] ERROR in handleSageSpark:');
      console.error('  - Message:', error.message);
      console.error('  - Stack:', error.stack);
      console.error('  - Full error:', error);
      this.showNotification('Failed: ' + error.message, 'error');
    }
  }

  extractTweetContext(composer) {
    try {
      // Look for the tweet we're replying to
      let container = composer;
      let article = null;
      
      // Search upwards for article
      for (let i = 0; i < 20; i++) {
        container = container.parentElement;
        if (!container) break;
        
        const articles = container.querySelectorAll('article[data-testid="tweet"]');
        if (articles.length > 0) {
          article = articles[0]; // Get first tweet (the one being replied to)
          break;
        }
      }
      
      if (!article) {
        // Fallback: search entire page
        const allArticles = document.querySelectorAll('article[data-testid="tweet"]');
        article = allArticles[0];
      }

      let tweetText = 'a tweet';
      let author = 'someone';

      if (article) {
        // Extract tweet text
        const textEl = article.querySelector('[data-testid="tweetText"]');
        if (textEl) {
          tweetText = textEl.innerText || textEl.textContent;
        }

        // Extract author
        const userEl = article.querySelector('[data-testid="User-Name"]');
        if (userEl) {
          author = userEl.innerText?.split('\n')[0] || 'someone';
        }
      }

      return {
        tweetText,
        author,
        threadContext: tweetText,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Context extraction error:', error);
      return {
        tweetText: 'a tweet',
        author: 'someone',
        threadContext: 'a conversation',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getUserProfile() {
    console.log('💾 [SAGE] Fetching from chrome.storage.local...');
    const result = await chrome.storage.local.get(['userProfile', 'stylePreferences', 'groqApiKey']);
    
    console.log('📦 [SAGE] Storage result:', result);
    console.log('  - userProfile:', result.userProfile);
    console.log('  - stylePreferences:', result.stylePreferences);
    console.log('  - groqApiKey exists:', !!result.groqApiKey);
    
    if (!result.groqApiKey) {
      console.error('❌ [SAGE] API key not found in storage!');
      throw new Error('API key not found. Check your .env file and reload extension.');
    }

    const profile = {
      profile: result.userProfile || { bio: 'Professional communicator', style: 'balanced' },
      preferences: result.stylePreferences || { tone: 'balanced', length: 'medium' },
      apiKey: result.groqApiKey
    };
    
    console.log('👤 [SAGE] Final user profile:', profile);
    return profile;
  }

  async generateReply(context, userProfile) {
    console.log('📨 [SAGE] Sending message to background script...');
    console.log('  - Action: generateReply');
    console.log('  - Context:', context);
    console.log('  - UserProfile:', userProfile);
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'generateReply',
        context,
        userProfile
      }, response => {
        console.log('📬 [SAGE] Received response from background script');
        console.log('  - Response object:', response);
        console.log('  - chrome.runtime.lastError:', chrome.runtime.lastError);
        
        if (chrome.runtime.lastError) {
          console.error('❌ [SAGE] Runtime error:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          console.error('❌ [SAGE] Error in response:', response.error);
          reject(new Error(response.error));
        } else if (response && response.reply) {
          console.log('✅ [SAGE] Got reply from background:', response.reply);
          resolve(response.reply);
        } else {
          console.error('❌ [SAGE] Invalid response format:', response);
          reject(new Error('No response from background script'));
        }
      });
    });
  }

  insertReply(editor, replyText) {
    console.log('📝 [SAGE] insertReply called');
    console.log('  - Editor:', editor);
    console.log('  - Reply text length:', replyText.length);
    console.log('  - Reply preview:', replyText.substring(0, 100));
    
    try {
      // Find the editable content div inside the editor
      console.log('🔍 [SAGE] Searching for editable element...');
      const editableDiv = editor.querySelector('[role="textbox"]') || 
                          editor.querySelector('[contenteditable="true"]') ||
                          editor;

      if (!editableDiv) {
        throw new Error('Could not find editable element');
      }
      
      console.log('✅ [SAGE] Editable element found:', editableDiv);
      console.log('  - Element tag:', editableDiv.tagName);
      console.log('  - Element attributes:', {
        role: editableDiv.getAttribute('role'),
        contenteditable: editableDiv.getAttribute('contenteditable'),
        testid: editableDiv.getAttribute('data-testid')
      });

      // Focus the editor
      console.log('👁️ [SAGE] Focusing editor...');
      editableDiv.focus();
      console.log('✅ [SAGE] Editor focused');
      
      // Use clipboard to paste the text (most reliable with Draft.js)
      console.log('📋 [SAGE] Writing text to clipboard...');
      navigator.clipboard.writeText(replyText).then(() => {
        console.log('✅ [SAGE] Text written to clipboard successfully');
        
        // Create and dispatch paste event
        console.log('📌 [SAGE] Creating paste event...');
        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer(),
          bubbles: true,
          cancelable: true
        });
        
        // Set the clipboard data
        Object.defineProperty(pasteEvent, 'clipboardData', {
          value: {
            getData: () => replyText,
            types: ['text/plain']
          }
        });

        console.log('📤 [SAGE] Dispatching paste event...');
        editableDiv.dispatchEvent(pasteEvent);
        console.log('✅ [SAGE] Paste event dispatched');
        
        // Also trigger input events for Draft.js to recognize the change
        console.log('⚡ [SAGE] Dispatching input event...');
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertFromPaste'
        });
        editableDiv.dispatchEvent(inputEvent);
        console.log('✅ [SAGE] Input event dispatched');

        console.log('✅✅✅ [SAGE] Text inserted via paste simulation successfully!');
        
      }).catch((error) => {
        console.error('❌ [SAGE] Clipboard write failed:', error);
        console.error('  - Error message:', error.message);
        console.error('  - Error type:', error.name);
        // Fallback: just copy to clipboard for manual paste
        this.showNotification('Reply copied to clipboard! Paste it manually.', 'info');
      });

    } catch (error) {
      console.error('❌ [SAGE] Insert error caught in try-catch:');
      console.error('  - Error message:', error.message);
      console.error('  - Error stack:', error.stack);
      this.showNotification('Could not insert text. Trying clipboard fallback...', 'error');
      
      // Ultimate fallback: copy to clipboard
      console.log('📋 [SAGE] Attempting clipboard fallback...');
      navigator.clipboard.writeText(replyText).then(() => {
        console.log('✅ [SAGE] Fallback: Text copied to clipboard');
        this.showNotification('Reply copied to clipboard! Paste it manually.', 'info');
      }).catch((err) => {
        console.error('❌ [SAGE] Fallback clipboard write also failed:', err);
        this.showNotification('Error: Could not insert reply', 'error');
      });
    }
  }

  showNotification(message, type = 'info') {
    const existing = document.querySelector('.sage-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `sage-notification sage-notification-${type}`;
    notification.innerHTML = `
      <div class="sage-notification-content">
        <span>${message}</span>
        <button class="sage-notification-close">×</button>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('sage-notification-fade');
      setTimeout(() => notification.remove(), 300);
    }, 4000);

    notification.querySelector('.sage-notification-close').addEventListener('click', () => {
      notification.remove();
    });
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new SAGEContentScript());
} else {
  new SAGEContentScript();
}

console.log('🚀 S.A.G.E. Content Script loaded');