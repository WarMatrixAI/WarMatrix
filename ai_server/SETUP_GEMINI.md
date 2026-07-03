# WarMatrix AI: Gemini API Setup (Cloud Mode)

This method allows you to use Google's Gemini API as the LLM provider. This is the best choice for users who do not have a powerful NVIDIA GPU or prefer a managed cloud-based AI experience.

## 1. Obtain a Gemini API Key

1. **Go to Google AI Studio**:
   - Visit [aistudio.google.com](https://aistudio.google.com/).
   - Sign in with your Google account.

2. **Generate API Key**:
   - Click on the **"Get API key"** button in the left-hand sidebar.
   - Click **"Create API key in new project"**.
   - Copy the generated key securely.

## 2. Configure WarMatrix

1. **Open PowerShell** in your workspace root.

2. **Activate your environment**:
   ```powershell
   & .\.venv\Scripts\Activate.ps1
   ```

3. **Set the Gemini environment variables**:
   ```powershell
   $env:USE_GEMINI = 'true'
   $env:GEMINI_API_KEY = 'YOUR_ACTUAL_API_KEY_HERE'
   ```

## 3. Verify Connection

1. **Run the WarMatrix AI server**:
   ```powershell
   python .\ai_server\backend_server.py
   ```

2. **Test the health endpoint**:
   ```powershell
   curl http://localhost:8000/health
   ```
   The response should confirm that the server is running and ready to proxy requests to the Gemini API.

## 4. Troubleshooting
- **Invalid API Key**: Ensure you copied the key correctly from AI Studio.
- **Quota Exceeded**: Free tier API keys have rate limits. If you encounter 429 errors, wait a few minutes or check your quota in the Google AI Studio dashboard.
- **Region Availability**: Ensure Gemini API is available in your current geographic region.

---
*Maintained by WarMatrix Operational Command.*
