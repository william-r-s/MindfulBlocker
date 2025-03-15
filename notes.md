## Architecture

- background.js: Handles URL blocking and bypass management
- secureStorage.js: Manages encrypted Claude API key storage
- conversation.js: Handles Claude interaction UI and logic
- settings.js: Manages block list and configuration
- contentExtractors.js: Handles safe content extraction from blocked sites

## Alternative Approaches Considered

### Blocking Implementation

Content Script Approach
- Inject scripts into pages to check URLs
- Rejected: Less reliable, can be circumvented

Proxy-based Blocking
- Route traffic through proxy to filter
- Rejected: Too complex for prototype

### AI Integration

Local AI Model
- Run smaller model locally
- Rejected: Poor performance/quality

Simple Rule-based System
- Basic checks without AI
- Rejected: Less effective for mindfulness

### Content Extraction Approaches

API-based Extraction
- Use site-specific APIs
- Rejected: Limited availability

Full Browser Rendering
- Render pages in background
- Rejected: Resource intensive

Simple HTML Parsing
- Basic content extraction
- Chosen: Balance of reliability and simplicity

### Security Approaches

Native App Component
- Store API key in native app
- Pro: Better security
- Con: Complex installation

Browser Password Manager
- Use built-in password manager
- Rejected: Less convenient

## Future Improvements

Enhanced Security
- Native app for API key storage
- Better protection from other extensions

Additional Features
- Read-only mode using Claude
- Site-specific conversation prompts
- Customizable bypass durations

Performance
- Cache common Claude responses
- Optimize blocking checks
- Improve content extraction reliability

## Setup

1. Install extension in Firefox
2. Add Claude API key in settings
3. Configure blocked sites
4. Restart Firefox

## Notes

- Enhanced prototype with content preview functionality
- Security adequate for personal use
- Mobile support through Firefox Android
- Contact developer within first 3 days for critical bug fixes
