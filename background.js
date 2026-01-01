// S.A.G.E. Background Service Worker - Handles API calls and business logic

class SAGEBackgroundService {
  constructor() {
    this.groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
    this.defaultModel = 'llama-3.1-70b-versatile'; // Fast and capable
    
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'generateReply') {
        this.handleGenerateReply(request, sendResponse);
        return true; // Keep channel open for async response
      }
      
      if (request.action === 'analyzeProfile') {
        this.handleAnalyzeProfile(request, sendResponse);
        return true;
      }
    });
  }

  async handleGenerateReply(request, sendResponse) {
    try {
      const { context, userProfile } = request;
      
      // Build the prompt based on user's style
      const prompt = this.buildReplyPrompt(context, userProfile.profile, userProfile.preferences);
      
      // Call Groq API
      const reply = await this.callGroqAPI(prompt, userProfile.apiKey);
      
      // Apply toxicity filter
      if (this.isToxic(reply)) {
        sendResponse({ 
          error: 'S.A.G.E. detected potentially harmful content and refused to generate this reply. Please try a different approach.' 
        });
        return;
      }
      
      sendResponse({ reply });
      
    } catch (error) {
      console.error('Background error:', error);
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
${profile.style || 'Casual but thoughtful'}

YOUR TASK:
Write a ${tone} reply that sounds natural and human. ${length}

CRITICAL RULES:
- Write ONLY the reply text, no quotes, no meta-commentary
- Match the user's authentic voice
- Be helpful and genuine, not generic or robotic
- Avoid hashtags unless absolutely necessary
- No spam, no toxicity, no manipulation
- Stay on topic and add value to the conversation
- If the tweet is controversial, be balanced and respectful

Reply:`;
  }

  async callGroqAPI(prompt, apiKey) {
    const response = await fetch(this.groqEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
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
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Groq API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from Groq API');
    }

    return data.choices[0].message.content.trim();
  }

  isToxic(text) {
    // Simple toxicity filter - checks for common toxic patterns
    const toxicPatterns = [
      /\b(kill|die|death)\s+(yourself|urself)\b/i,
      /\bf+[ua*]+c+k+\s+(you|u|off)\b/i,
      /\bh[a@]te\s+(you|speech)\b/i,
      /\b(stupid|idiot|moron)\s+(n|b)[i1!]gg[ea@]r*\b/i,
      /\bk[i1!]ll\s+all\b/i
    ];

    return toxicPatterns.some(pattern => pattern.test(text));
  }

  async handleAnalyzeProfile(request, sendResponse) {
    try {
      const { tweets, bio } = request;
      
      // Analyze writing style from tweets
      const styleAnalysis = this.analyzeTweets(tweets);
      
      const profile = {
        bio: bio || '',
        style: styleAnalysis.style,
        avgLength: styleAnalysis.avgLength,
        commonPhrases: styleAnalysis.commonPhrases,
        tone: styleAnalysis.tone
      };
      
      // Store profile
      await chrome.storage.local.set({ userProfile: profile });
      
      sendResponse({ success: true, profile });
      
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  analyzeTweets(tweets) {
    if (!tweets || tweets.length === 0) {
      return {
        style: 'professional',
        avgLength: 150,
        commonPhrases: [],
        tone: 'balanced'
      };
    }

    // Calculate average length
    const avgLength = tweets.reduce((sum, t) => sum + t.length, 0) / tweets.length;

    // Detect tone
    const hasEmojis = tweets.some(t => /[\u{1F600}-\u{1F64F}]/u.test(t));
    const hasQuestions = tweets.filter(t => t.includes('?')).length / tweets.length > 0.3;
    const hasCasualLang = tweets.some(t => /\b(lol|omg|tbh|imo|btw)\b/i.test(t));

    let tone = 'balanced';
    if (hasQuestions) tone = 'inquisitive';
    if (hasCasualLang) tone = 'casual';
    if (!hasEmojis && !hasCasualLang) tone = 'professional';

    // Extract common phrases (simplified)
    const words = tweets.join(' ').toLowerCase().split(/\s+/);
    const wordFreq = {};
    words.forEach(w => {
      if (w.length > 4) wordFreq[w] = (wordFreq[w] || 0) + 1;
    });
    
    const commonPhrases = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return {
      style: tone,
      avgLength: Math.round(avgLength),
      commonPhrases,
      tone
    };
  }
}

// Initialize the service
new SAGEBackgroundService();

console.log('🌟 S.A.G.E. Background Service initialized');