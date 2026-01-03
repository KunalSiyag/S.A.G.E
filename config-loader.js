// S.A.G.E. Configuration Loader - Reads .env and Summary.txt

class ConfigLoader {
  constructor() {
    this.apiKey = null;
    this.summary = null;
    this.loaded = false;
  }

  async loadConfig() {
    if (this.loaded) {
      return { apiKey: this.apiKey, summary: this.summary };
    }

    try {
      // Load .env file
      await this.loadEnvFile();
      
      // Load Summary.txt file
      await this.loadSummaryFile();
      
      // Store in chrome.storage for easy access
      await chrome.storage.local.set({
        groqApiKey: this.apiKey,
        userProfile: {
          bio: this.summary,
          style: 'balanced'
        }
      });

      this.loaded = true;
      console.log('✅ S.A.G.E. config loaded from files');
      
      return { apiKey: this.apiKey, summary: this.summary };
      
    } catch (error) {
      console.error('❌ Failed to load config files:', error);
      throw error;
    }
  }

  async loadEnvFile() {
    try {
      const envUrl = chrome.runtime.getURL('.env');
      const response = await fetch(envUrl);
      
      if (!response.ok) {
        throw new Error('.env file not found. Make sure it exists in your extension folder.');
      }
      
      const envContent = await response.text();
      
      // Parse .env file
      const lines = envContent.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;
        
        // Parse KEY=VALUE format
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        
        if (key.trim() === 'GROQ_API_KEY') {
          // Remove quotes if present
          this.apiKey = value.replace(/^["']|["']$/g, '');
          console.log('✅ API key loaded from .env');
        }
      }
      
      if (!this.apiKey) {
        throw new Error('GROQ_API_KEY not found in .env file');
      }
      
    } catch (error) {
      console.error('Error loading .env:', error);
      throw new Error('Failed to load .env file: ' + error.message);
    }
  }

  async loadSummaryFile() {
    try {
      const summaryUrl = chrome.runtime.getURL('Summary.txt');
      const response = await fetch(summaryUrl);
      
      if (!response.ok) {
        console.warn('⚠️ Summary.txt not found. Using default profile.');
        this.summary = 'Professional and authentic communicator.';
        return;
      }
      
      this.summary = await response.text();
      this.summary = this.summary.trim();
      
      console.log('✅ Writing style loaded from Summary.txt');
      
    } catch (error) {
      console.error('Error loading Summary.txt:', error);
      this.summary = 'Professional and authentic communicator.';
    }
  }

  getApiKey() {
    return this.apiKey;
  }

  getSummary() {
    return this.summary;
  }

  async reloadConfig() {
    this.loaded = false;
    return await this.loadConfig();
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigLoader;
}