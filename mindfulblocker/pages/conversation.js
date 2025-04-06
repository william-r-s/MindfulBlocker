console.log("Conversation script loading");

// Parse URL parameters
const urlParams = new URLSearchParams(window.location.search);
const domain = urlParams.get('domain');
const blockReason = urlParams.get('reason');
const isExpired = urlParams.get('expired') === 'true';
const fullUrl = urlParams.get('url') || `https://${domain}`;

// Keep an in-memory conversation history array of user/assistant messages only
let conversationHistory = [];
let accessHistory = [];

// Regex to enforce a match for the grant phrase, ignoring leading whitespace/ other trailing text
const EXACT_GRANT_REGEX = /^\s*ACCESS GRANTED for (\d+) minutes?.*$/m;
// When the page loads, set up everything
document.addEventListener('DOMContentLoaded', initConversation);

// Function no longer needed, removing password requirement
async function getPasswordFromUser() {
    // No password required anymore
    return null;
}

async function initConversation() {
    try {
        // Check if this is an expired bypass redirect
        if (isExpired) {
            const expiredNotice = document.getElementById('expiredNotice');
            expiredNotice.style.display = 'block';
        }

        // Check if API key exists, but no longer need password
        const data = await storageHelper.get(['apiKey', 'accessHistory', 'tempExtractedContent', 'systemPromptTemplate']);
        if (!data.apiKey) {
            displayError('No API key found. Please add your Claude API key in the extension settings.');
            return;
        }

        console.log('Full URL being accessed:', fullUrl);

        // Get recent attempts for context
        const history = data.accessHistory || {};
        const recentAttempts = history[domain]?.slice(-5) || [];
        const historyText = recentAttempts.length > 0
            ? `Recent access attempts:\n${recentAttempts.map(a =>
                ` - ${new Date(a.timestamp).toLocaleString()} (${a.granted ? 'granted' : 'denied'})`
            ).join('\n')}`
            : 'No recent access attempts.';

        // Get extracted content
        const extractedContent = data.tempExtractedContent?.extractedContent;
        const contentSection = extractedContent ?
            `\nEXTRACTED CONTENT:
Title: ${extractedContent.title}
Content: ${extractedContent.content}
Type: ${extractedContent.type}`
            : '\nNo content available';

        // Update block context display with full URL
        const blockContext = document.getElementById('blockContext');
        if (blockReason) {
            blockContext.textContent = `You've blocked ${domain} (${fullUrl}) because: ${blockReason}`;
        } else {
            blockContext.textContent = `You've blocked ${domain} (${fullUrl})`;
        }

        // Prepare variables for the prompt
        const promptVariables = {
            domain,
            fullUrl,
            blockReason,
            historyText,
            title: extractedContent?.title || 'Not available',
            content: extractedContent?.content || 'No content available'
        };

        // Get the template from settings or use default
        let template = data.systemPromptTemplate;
        if (!template && window.DEFAULT_SYSTEM_PROMPT) {
            template = window.DEFAULT_SYSTEM_PROMPT;
        } else if (!template) {
            throw new Error('No prompt template available. Please check your extension settings.');
        }
        
        // Replace placeholders in the template
        window.systemInstructions = template
            .replace(/{{domain}}/g, promptVariables.domain)
            .replace(/{{blockReason}}/g, promptVariables.blockReason || '')
            .replace(/{{historyText}}/g, promptVariables.historyText)
            .replace(/{{title}}/g, promptVariables.title)
            .replace(/{{content}}/g, promptVariables.content)
            .replace(/{{fullUrl}}/g, promptVariables.fullUrl);

    } catch (error) {
        displayError(`Error initializing conversation: ${error.message}`);
    }
}

async function sendMessage(userMessage) {
    try {
        // Add the user's message to the local conversation
        conversationHistory.push({ role: 'user', content: userMessage });
        updateConversationDisplay();

        // Format messages for the API
        const formattedMessages = conversationHistory.map(msg => {
            const content = typeof msg.content === 'string' ? msg.content :
                msg.content?.text || JSON.stringify(msg.content);
            return {
                role: msg.role,
                content: content
            };
        });

        const response = await browser.runtime.sendMessage({
            type: 'claudeAPI',
            // No longer sending password
            data: {
                model: 'claude-3-7-sonnet-20250219',
                max_tokens: 1000,
                temperature: 0.0,
                messages: formattedMessages,
                system: window.systemInstructions
            }
        });

        console.log('API Response:', response);

        if (response.error) {
            throw new Error(`Claude API Error: ${JSON.stringify(response.error)}`);
        }

        // Extract Claude's response from the API response
        let claudeResponse;
        if (response.content && Array.isArray(response.content)) {
            claudeResponse = response.content[0];
        } else if (response.messages && response.messages[0]) {
            claudeResponse = response.messages[0].content;
        } else if (response.content) {
            claudeResponse = response.content;
        } else {
            console.error('Unexpected response structure:', response);
            throw new Error('Could not find Claude response in API result');
        }

        // Convert response to string, ensuring we capture the full message
        const responseText = typeof claudeResponse === 'string' ? claudeResponse :
            claudeResponse?.content || claudeResponse?.text || JSON.stringify(claudeResponse);

        console.log('Processing Claude response:', responseText);

        // Add Claude's response to our local conversation
        conversationHistory.push({ role: 'assistant', content: responseText });
        updateConversationDisplay();
        console.log('About to check for grant in:', responseText);
        console.log('Full Claude response:', responseText);
        console.log('EXACT_GRANT_REGEX:', EXACT_GRANT_REGEX);
        // Check for access grant
        if (responseText && responseText.trim().match(EXACT_GRANT_REGEX)) {
            console.log('Access grant detected:', responseText.trim());
            const match = responseText.trim().match(EXACT_GRANT_REGEX);
            const duration = parseInt(match[1], 10);
            await handleBypassApproval(duration);
        } else {
            console.log('No access grant detected in response');
        }
    } catch (error) {
        // No longer handling invalid password errors specifically
        console.error('Full error details:', error);
        displayError(`Failed to communicate with Claude: ${error.message}`);
    }
}

// If Claude grants bypass, call the background script
async function handleBypassApproval(duration) {
    try {
        await browser.runtime.sendMessage({
            type: 'grantBypass',
            domain: domain,
            duration: duration
        });

        const container = document.getElementById('conversationHistory');
        
        // Create elements instead of using innerHTML
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message success';
        
        const messagePara = document.createElement('p');
        
        // Split content by newlines and add each line with a proper break
        const contentLines = `✅ Access granted for ${duration} minutes. Redirecting...`.split('\n');
        
        contentLines.forEach((line, index) => {
            // Create a text node for the line
            const textNode = document.createTextNode(line);
            messagePara.appendChild(textNode);
            
            // Add line break after each line except the last one
            if (index < contentLines.length - 1) {
                messagePara.appendChild(document.createElement('br'));
            }
        });
        
        messageDiv.appendChild(messagePara);
        container.appendChild(messageDiv);

        // Redirect to the fullUrl after a short delay
        setTimeout(() => {
            window.location.href = fullUrl;
        }, 2000);
    } catch (error) {
        displayError('Failed to grant access: ' + error.message);
    }
}

// Update the chat window
function updateConversationDisplay() {
    const container = document.getElementById('conversationHistory');
    
    // Clear previous content
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    // Rebuild using DOM methods instead of innerHTML
    conversationHistory.forEach(msg => {
        const cssClass = msg.role === 'assistant' ? 'assistant' : 'user';
        const name = msg.role === 'assistant' ? 'Claude' : 'You';

        // Handle different types of content
        let content = msg.content;
        if (typeof content === 'object') {
            content = content.text || JSON.stringify(content);
        }

        // Create message div
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${cssClass}`;
        
        // Create name element
        const nameElement = document.createElement('strong');
        nameElement.textContent = `${name}:`;
        
        // Create content paragraph
        const contentPara = document.createElement('p');
        
        // Split content by newlines and add each line with a proper break
        const contentLines = content.split('\n');
        
        contentLines.forEach((line, index) => {
            // Create a text node for the line
            const textNode = document.createTextNode(line);
            contentPara.appendChild(textNode);
            
            // Add line break after each line except the last one
            if (index < contentLines.length - 1) {
                contentPara.appendChild(document.createElement('br'));
            }
        });
        
        // Append elements
        messageDiv.appendChild(nameElement);
        messageDiv.appendChild(contentPara);
        container.appendChild(messageDiv);
    });
    
    container.scrollTop = container.scrollHeight;
}

// Show an error box in the conversation
function displayError(message) {
    const container = document.getElementById('conversationHistory');
    
    // Create error message using DOM methods instead of innerHTML
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message error';
    
    const errorPara = document.createElement('p');
    
    // Split message by newlines and add each line with a proper break
    const messageLines = `❌ Error: ${message}`.split('\n');
    
    messageLines.forEach((line, index) => {
        // Create a text node for the line
        const textNode = document.createTextNode(line);
        errorPara.appendChild(textNode);
        
        // Add line break after each line except the last one
        if (index < messageLines.length - 1) {
            errorPara.appendChild(document.createElement('br'));
        }
    });
    
    errorDiv.appendChild(errorPara);
    container.appendChild(errorDiv);
    container.scrollTop = container.scrollHeight;
}

// Event listeners for the Send button / Enter key
document.getElementById('sendMessage').addEventListener('click', () => {
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    if (!message) return;
    sendMessage(message);
    userInput.value = '';
});

document.getElementById('userInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('sendMessage').click();
    }
});

document.getElementById('sendMessage').addEventListener('touchend', (e) => {
    e.preventDefault();
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    if (!message) return;
    sendMessage(message);
    userInput.value = '';
});
