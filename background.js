// S.A.G.E. Background Service Worker - Handles API calls and loads config from files

class SAGEBackgroundService {
  constructor() {
    this.groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
    this.defaultModel = 'openai/gpt-oss-120b';
    this.configLoaded = false;
    
    this.init();
  }

  async init() {
    // Load config from .env and Summary.txt on startup
    await this.loadConfigFiles();
    
    // Setup message listener
    this.setupMessageListener();
  }

  async loadConfigFiles() {
    try {
      console.log('📂 [BG] Loading S.A.G.E. configuration files...');
      
      // Load .env file
      console.log('📄 [BG] Fetching .env file...');
      const envUrl = chrome.runtime.getURL('.env');
      console.log('  - URL:', envUrl);
      const envResponse = await fetch(envUrl);
      
      if (!envResponse.ok) {
        console.error('❌ [BG] .env file not found. Status:', envResponse.status);
        throw new Error('.env file not found');
      }
      
      const envContent = await envResponse.text();
      console.log('✅ [BG] .env file fetched successfully');
      const apiKey = this.parseEnvFile(envContent);
      console.log('✅ [BG] API Key parsed:', apiKey.substring(0, 10) + '...');
      
      // Load Summary.txt file
      console.log('📄 [BG] Fetching Summary.txt file...');
      const summaryUrl = chrome.runtime.getURL('Summary.txt');
      console.log('  - URL:', summaryUrl);
      const summaryResponse = await fetch(summaryUrl);
      
      let summary = 'Professional and authentic communicator.';
      if (summaryResponse.ok) {
        summary = await summaryResponse.text();
        summary = summary.trim();
        console.log('✅ [BG] Summary.txt fetched successfully');
        console.log('  - Content:', summary.substring(0, 100) + '...');
      } else {
        console.warn('⚠️ [BG] Summary.txt not found, using default');
      }
      
      // Store in chrome.storage
      console.log('💾 [BG] Storing config in chrome.storage.local...');
      await chrome.storage.local.set({
        groqApiKey: apiKey,
        userProfile: {
          bio: summary,
          style: 'balanced'
        },
        stylePreferences: {
          tone: 'balanced',
          length: 'medium'
        }
      });
      console.log('✅ [BG] Stored successfully in chrome.storage');
      
      this.configLoaded = true;
      console.log('✅✅✅ [BG] S.A.G.E. configuration loaded successfully!');
      console.log('   - API Key: ✓ Loaded');
      console.log('   - User Bio: ✓ Loaded');
      console.log('   - Style Preferences: ✓ Loaded');
      
    } catch (error) {
      console.error('❌ [BG] Failed to load config files:', error);
      console.error('   Error message:', error.message);
      console.error('   Stack:', error.stack);
    }
  }

  parseEnvFile(content) {
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;
      
      // Parse KEY=VALUE format
      const [key, ...valueParts] = trimmedLine.split('=');
      const value = valueParts.join('=').trim();
      
      if (key.trim() === 'GROQ_API_KEY') {
        // Remove quotes if present
        return value.replace(/^["']|["']$/g, '');
      }
    }
    
    throw new Error('GROQ_API_KEY not found in .env file');
  }

  setupMessageListener() {
    console.log('🎧 [BG] Setting up message listener...');
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📬 [BG] Received message:');
      console.log('  - Action:', request.action);
      console.log('  - From:', sender.url);
      
      if (request.action === 'generateReply') {
        console.log('🎯 [BG] Handling generateReply action');
        this.handleGenerateReply(request, sendResponse);
        return true;
      }
      
      if (request.action === 'reloadConfig') {
        console.log('🔄 [BG] Handling reloadConfig action');
        this.loadConfigFiles().then(() => {
          console.log('✅ [BG] Config reloaded, sending response');
          sendResponse({ success: true });
        });
        return true;
      }
      
      console.warn('⚠️ [BG] Unknown action:', request.action);
    });
    
    console.log('✅ [BG] Message listener setup complete');
  }

  async handleGenerateReply(request, sendResponse) {
    try {
      console.log('🚀 [BG] Starting reply generation...');
      const { context, userProfile } = request;
      
      console.log('📥 [BG] Request data received:');
      console.log('  - Context:', context);
      console.log('  - User Profile:', userProfile);
      
      // Build the prompt based on user's style
      console.log('🛠️ [BG] Building prompt...');
      const prompt = this.buildReplyPrompt(context, userProfile.profile, userProfile.preferences);
      console.log('✅ [BG] Prompt built:');
      console.log('---PROMPT START---');
      console.log(prompt);
      console.log('---PROMPT END---');
      
      // Call Groq API
      console.log('🌐 [BG] Calling Groq API...');
      console.log('  - Endpoint:', this.groqEndpoint);
      console.log('  - Model:', this.defaultModel);
      const reply = await this.callGroqAPI(prompt, userProfile.apiKey);
      
      console.log('✅ [BG] Groq API response received!');
      console.log('  - Reply:', reply);
      console.log('  - Length:', reply.length, 'characters');
      
      // Apply toxicity filter
      console.log('🛡️ [BG] Checking for toxicity...');
      if (this.isToxic(reply)) {
        console.warn('⚠️ [BG] Toxicity detected in reply! Blocking...');
        sendResponse({ 
          error: 'S.A.G.E. detected potentially harmful content and refused to generate this reply. Please try a different approach.' 
        });
        return;
      }
      console.log('✅ [BG] Toxicity check passed');
      
      console.log('📤 [BG] Sending reply back to content script');
      sendResponse({ reply });
      
    } catch (error) {
      console.error('❌ [BG] ERROR in handleGenerateReply:');
      console.error('  - Message:', error.message);
      console.error('  - Stack:', error.stack);
      console.error('  - Full error:', error);
      sendResponse({ error: error.message });
    }
  }

  buildReplyPrompt(context, profile, preferences) {
    const toneMap = {
      'agree': 'supportive and affirming',
      'witty': 'clever and humorous',
      'inquisitive': 'curious and question-asking',
      'balanced': 'thoughtful and authentic'
    };

    const lengthMap = {
      'short': 'Keep it brief - 1-2 sentences max (under 100 characters).',
      'medium': 'Medium length - 2-3 sentences (100-200 characters).',
      'long': 'Detailed response - 3-4 sentences (200-280 characters).'
    };

    const tone = toneMap[preferences.tone] || toneMap.balanced;
    const length = lengthMap[preferences.length] || lengthMap.medium;

    return `You are helping to write an authentic reply to a tweet. 

ORIGINAL TWEET:
"${context.tweetText}"
Author: ${context.author}

THREAD CONTEXT:
${context.threadContext}

USER'S WRITING STYLE:
${profile.bio || 'Professional and authentic'}

YOUR TASK:
Write a ${tone} reply that sounds natural and human. ${length}

CRITICAL RULES:
- Write ONLY the reply text, no quotes, no meta-commentary
- Match the user's authentic voice based on their writing style above
- Be helpful and genuine, not generic or robotic
- Avoid hashtags unless absolutely necessary
- No spam, no toxicity, no manipulation
- Stay on topic and add value to the conversation
- If the tweet is controversial, be balanced and respectful

Reply:`;
  }

  async callGroqAPI(prompt, apiKey) {
    console.log('📡 [BG] callGroqAPI - Preparing request...');
    console.log('  - Endpoint:', this.groqEndpoint);
    console.log('  - Model:', this.defaultModel);
    console.log('  - API Key length:', apiKey.length);
    
    const requestBody = {
      model: this.defaultModel,
      messages: [
        {
          role: 'system',
          content: 'You are S.A.G.E., an AI assistant that helps users write authentic, high-quality social media replies. You match their unique voice and style while maintaining genuineness and helpfulness.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 150,
      top_p: 0.9
    };
    
    console.log('📤 [BG] Sending request to Groq...');
    console.log('  - Body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(this.groqEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📬 [BG] Received response from Groq');
    console.log('  - Status:', response.status);
    console.log('  - Status Text:', response.statusText);

    if (!response.ok) {
      console.error('❌ [BG] Groq API returned error status');
      const errorData = await response.json().catch(() => ({}));
      console.error('  - Error data:', errorData);
      throw new Error(errorData.error?.message || `Groq API error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('✅ [BG] Response parsed successfully');
    console.log('  - Full response data:', JSON.stringify(data, null, 2));
    console.log('  - Choices count:', data.choices?.length);
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ [BG] Invalid response structure from Groq');
      console.error('  - Response:', data);
      throw new Error('Invalid response from Groq API');
    }

    const replyContent = data.choices[0].message.content.trim();
    console.log('✅✅✅ [BG] Reply extracted successfully');
    console.log('  - Reply:', replyContent);
    console.log('  - Characters:', replyContent.length);
    
    return replyContent;
  }

  isToxic(text) {
    console.log('🛡️ [BG] isToxic - Checking text...');
    console.log('  - Text length:', text.length);
    console.log('  - Text preview:', text.substring(0, 100));
    
    const toxicPatterns = [
      /\b(kill|die|death)\s+(yourself|urself)\b/i,
      /\bf+[ua*]+c+k+\s+(you|u|off)\b/i,
      /\bh[a@]te\s+(you|speech)\b/i,
      /\b(stupid|idiot|moron)\s+(n|b)[i1!]gg[ea@]r*\b/i,
      /\bk[i1!]ll\s+all\b/i
    ];

    const isToxic = toxicPatterns.some(pattern => pattern.test(text));
    
    if (isToxic) {
      console.warn('⚠️ [BG] TOXICITY DETECTED!');
      console.warn('  - Text:', text);
    } else {
      console.log('✅ [BG] No toxicity detected');
    }
    
    return isToxic;
  }
}

// Initialize the service
console.log('🌟 [BG] S.A.G.E. Background Service Worker Starting...');
const sageService = new SAGEBackgroundService();
console.log('✅ [BG] S.A.G.E. Background Service initialized and ready!');