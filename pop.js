document.addEventListener('DOMContentLoaded', async () => {
  const fields = ['groqApiKey', 'userProfile', 'stylePreferences'];
  const data = await chrome.storage.local.get(fields);

  if (data.groqApiKey) document.getElementById('apiKey').value = data.groqApiKey;
  if (data.userProfile?.bio) document.getElementById('userBio').value = data.userProfile.bio;
  if (data.stylePreferences?.tone) document.getElementById('tone').value = data.stylePreferences.tone;

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKey').value;
    const bio = document.getElementById('userBio').value;
    const tone = document.getElementById('tone').value;

    await chrome.storage.local.set({
      groqApiKey: apiKey,
      userProfile: { bio: bio, style: 'custom' },
      stylePreferences: { tone: tone, length: 'medium' }
    });

    const status = document.getElementById('status');
    status.textContent = 'Settings Saved! ✨';
    setTimeout(() => status.textContent = '', 2000);
  });
});