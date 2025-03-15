# Mindful Blocker

A Firefox extension that helps users be more mindful of their browsing habits by requiring a conversation with Claude AI before accessing blocked websites.

The idea is to introduce a pause where you can reflect on your motivation for accessing the website, talk about it with Claude, possibly consider other alternatives. The extension supports asking a specific narrow question about the page content, e.g. if you want to know if there's any new headlines about a specific topic in the news, don't want to be distracted by everything else.

Should work on both desktop and mobile firefox

# Configuration
- Create a Claude API key https://console.anthropic.com
- Set the API key in your extension
- Set web pages you want to block

# Security
- This extension look at all web requests to determine whether they are to a blocked domain
- When accessing a blocked domain, the extension uses the anthropic api to have the conversation with Claude. Claude receives the domain and the history of access
- If you enable "Show LLM page content?" the extension tries to extract content from the web page and also passes it to the language model.


Thanks to [Kerrigan Madden](https://github.com/handoftheenemy) for developing the initial version of this extension.