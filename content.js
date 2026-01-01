// S.A.G.E. Content Script - Injects AI assistance into X/Twitter

class SAGEContentScript {
  constructor() {
    this.replyBoxSelector = 'div[data-testid="tweetTextarea_0"]';
    this.tweetSelector = 'article[data-testid="tweet"]';
    this.initialized = false;
    this.rateLimitCount = 0;
    this.rateLimitWindow = 3600000; // 1 hour
    this.maxRepliesPerHour = 20;
    
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
    
    console.log('🌟 S.A.G.E. initialized');
  }

  observeDOM() {
    const observer = new MutationObserver(() => {
      this.injectSageButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial injection
    this.injectSageButtons();
  }

  injectSageButtons() {
    // Find all reply boxes that don't have a SAGE button yet
    const replyBoxes = document.querySelectorAll(this.replyBoxSelector);
    
    replyBoxes.forEach(box => {
      if (box.getAttribute('data-sage-enabled')) return;
      
      box.setAttribute('data-sage-enabled', 'true');
      this.addSageButton(box);
    });
  }

  addSageButton(replyBox) {
    // Find the parent container
    const container = replyBox.closest('div[data-testid="toolBar"]')?.parentElement || replyBox.parentElement;
    if (!container) return;

    // Create SAGE Spark button
    const sageBtn = document.createElement('button');
    sageBtn.className = 'sage-spark-button';
    sageBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
              fill="currentColor" stroke="currentColor" stroke-width="2"/>
      </svg>
      <span>S.A.G.E. Spark</span>
    `;
    sageBtn.title = 'Generate an authentic reply';
    
    sageBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSageSpark(replyBox);
    });

    // Insert button near the reply box
    const toolbar = container.querySelector('div[data-testid="toolBar"]');
    if (toolbar) {
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'sage-button-container';
      buttonContainer.appendChild(sageBtn);
      toolbar.insertBefore(buttonContainer, toolbar.firstChild);
    }
  }

  async handleSageSpark(replyBox) {
    // Rate limiting check
    if (this.rateLimitCount >= this.maxRepliesPerHour) {
      this.showNotification('Rate limit reached. S.A.G.E. needs to rest for a bit! 🌙', 'warning');
      return;
    }

    // Get context
    const tweetContext = this.extractTweetContext(replyBox);
    if (!tweetContext) {
      this.showNotification('Could not extract tweet context', 'error');
      return;
    }

    // Show loading state
    this.showNotification('✨ S.A.G.E. is crafting your reply...', 'loading');

    try {
      // Get user's style profile
      const userProfile = await this.getUserProfile();
      
      // Generate reply
      const reply = await this.generateReply(tweetContext, userProfile);
      
      // Insert into reply box
      this.insertReply(replyBox, reply);
      
      this.rateLimitCount++;
      this.showNotification('Reply generated! Edit as needed and post 🎯', 'success');
      
    } catch (error) {
      console.error('S.A.G.E. error:', error);
      this.showNotification('Failed to generate reply: ' + error.message, 'error');
    }
  }

  extractTweetContext(replyBox) {
    // Find the tweet being replied to
    const tweetArticle = replyBox.closest('article') || 
                         document.querySelector('article[data-testid="tweet"]');
    
    if (!tweetArticle) return null;

    // Extract tweet text
    const tweetTextElement = tweetArticle.querySelector('div[data-testid="tweetText"]');
    const tweetText = tweetTextElement ? tweetTextElement.innerText : '';

    // Extract author info
    const authorElement = tweetArticle.querySelector('div[data-testid="User-Name"]');
    const author = authorElement ? authorElement.innerText : 'Unknown';

    // Try to get thread context
    const threadTweets = document.querySelectorAll('article[data-testid="tweet"] div[data-testid="tweetText"]');
    const threadContext = Array.from(threadTweets).slice(0, 3).map(el => el.innerText).join('\n---\n');

    return {
      tweetText,
      author,
      threadContext: threadContext || tweetText,
      timestamp: new Date().toISOString()
    };
  }

  async getUserProfile() {
    // Get stored user profile
    const result = await chrome.storage.local.get(['userProfile', 'stylePreferences', 'groqApiKey']);
    
    if (!result.groqApiKey) {
      throw new Error('Please set your Groq API key in S.A.G.E. settings');
    }

    return {
      profile: result.userProfile || { bio: '', style: 'professional' },
      preferences: result.stylePreferences || { tone: 'balanced', length: 'medium' },
      apiKey: result.groqApiKey
    };
  }

  async generateReply(context, userProfile) {
    // Send to background script for API call
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'generateReply',
        context,
        userProfile
      }, response => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.reply);
        }
      });
    });
  }

  insertReply(replyBox, replyText) {
    // Focus the reply box
    replyBox.focus();

    // Insert text (different methods for different browsers)
    if (replyBox.contentEditable === 'true') {
      // For contenteditable divs
      replyBox.innerText = replyText;
      
      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      replyBox.dispatchEvent(inputEvent);
    } else {
      // For textarea elements
      replyBox.value = replyText;
      
      const inputEvent = new Event('input', { bubbles: true });
      replyBox.dispatchEvent(inputEvent);
    }

    // Place cursor at end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(replyBox);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  showNotification(message, type = 'info') {
    // Remove existing notifications
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

    // Auto-remove after 4 seconds
    setTimeout(() => {
      notification.classList.add('sage-notification-fade');
      setTimeout(() => notification.remove(), 300);
    }, 4000);

    // Close button
    notification.querySelector('.sage-notification-close').addEventListener('click', () => {
      notification.remove();
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new SAGEContentScript());
} else {
  new SAGEContentScript();
}