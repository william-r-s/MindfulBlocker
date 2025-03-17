// Initialize global variables
let blockedSites = {};
let bypassList = {};
var currentListener = null;

console.log("Background script loaded!");

// Load settings when extension starts
storageHelper.get(['blockedSites', 'bypassList']).then(result => {
    console.log("Loading storage on startup:", result);
    blockedSites = result.blockedSites || {};
    bypassList = result.bypassList || {};
    console.log("Initialized blockedSites:", blockedSites);
    
    // Clean up expired bypasses
    const now = Date.now();
    let changed = false;
    for (const [domain, bypass] of Object.entries(bypassList)) {
        if (bypass.expiresAt < now) {
            delete bypassList[domain];
            changed = true;
        }
    }
    if (changed) {
        storageHelper.set({ bypassList });
    }

    updateBlockedSites();
});

// Debug storage
storageHelper.get(['blockedSites']).then(result => {
    console.log("Current blocked sites:", result.blockedSites);
});

// Debug storage changes
browser.storage.onChanged.addListener((changes, area) => {
    console.log("Storage changed:", changes);
});
// Import secure storage


console.log("Background script starting...");


function getBlockedUrlPatterns() {
    // Always return all URLs since we'll do our own matching
    return ["<all_urls>"];
}

// Load settings when extension starts
storageHelper.get(['blockedSites', 'bypassList']).then(result => {
    console.log("Loaded storage:", result);
    blockedSites = result.blockedSites || {};
    bypassList = result.bypassList || {};
    console.log("Initialized blockedSites:", blockedSites);

    // Clean up expired bypasses
    const now = Date.now();
    let changed = false;
    for (const [domain, bypass] of Object.entries(bypassList)) {
        if (bypass.expiresAt < now) {
            delete bypassList[domain];
            changed = true;
        }
    }
    if (changed) {
        storageHelper.set({ bypassList });
    }

    // Initialize the web request listener with current blocked sites
    updateBlockedSites();
});


async function logAccessAttempt(domain, granted = false, duration = null) {
    // Only log if it's a grant
    if (!granted) {
        return; // Don't log non-grants for now
    }

    const data = await storageHelper.get('accessHistory');
    const history = data.accessHistory || {};

    if (!history[domain]) {
        history[domain] = [];
    }

    history[domain].push({
        timestamp: Date.now(),
        granted: true,
        duration: duration // Add duration for grants
    });

    // Keep only last 50 attempts per domain
    if (history[domain].length > 50) {
        history[domain] = history[domain].slice(-50);
    }

    await storageHelper.set({ accessHistory: history });
}


function hasActiveBypass(domain) {
    console.log("Checking bypass for:", domain, "Current bypassList:", bypassList);

    const bypass = bypassList[domain];
    if (!bypass) {
        console.log("No bypass found for", domain);
        return false;
    }

    if (bypass.expiresAt < Date.now()) {
        console.log("Bypass expired for", domain);
        delete bypassList[domain];
        storageHelper.set({ bypassList });
        return false;
    }

    console.log("Valid bypass found for", domain, "expires:", new Date(bypass.expiresAt));
    return true;
}



async function addBypass(domain, durationMinutes = 30) {
    console.log(`Adding bypass for ${domain} for ${durationMinutes} minutes`);

    const expiresAt = Date.now() + (durationMinutes * 60 * 1000);
    bypassList[domain] = {
        grantedAt: Date.now(),
        expiresAt: expiresAt
    };

    // Only save bypass list, history is handled by logAccessAttempt
    await storageHelper.set({ bypassList });

    console.log(`Bypass added for ${domain}`);
    
    // Set up expiration timer
    setTimeout(() => handleBypassExpiration(domain), durationMinutes * 60 * 1000);
}

async function handleRequest(details) {
    const url = new URL(details.url);
    const fullUrl = details.url.toLowerCase();

    console.log("Processing request:", {
        url: fullUrl
    });

    // Find matching block rule using the shared matchesDomain function
    const matchingRule = Object.entries(blockedSites).find(([key, data]) => {
        return matchesDomain(key, fullUrl);
    });

    if (!matchingRule) {
        return { cancel: false };
    }

    const [ruleKey] = matchingRule;

    if (hasActiveBypass(ruleKey)) {
        console.log(`Active bypass found for ${ruleKey}`);
        return { cancel: false };
    }

    try {
        // Extract content
        let extractedContent;
        try {
            const response = await fetch(details.url);
            const text = await response.text();

            // Get user's content extraction preference
            const data = await storageHelper.get(['enableContentExtraction']);
            const showPageContent = data.enableContentExtraction !== undefined ? data.enableContentExtraction : true;

            console.log(`Page content ${showPageContent ? 'will be shown' : 'will NOT be shown'} to LLM for ${details.url}`);

            // Skip content extraction entirely if disabled
            if (!showPageContent) {
                console.log('Content extraction skipped - page content will not be included in prompt');
                extractedContent = {
                    title: 'Content Hidden',
                    content: 'Page content is intentionally hidden from LLM per user settings.',
                    type: 'hidden'
                };
            } else {
                // Extract content since it's enabled
                const extractor = window.getExtractor(details.url);
                console.log(`Using content extractor: ${extractor.type}`);
                extractedContent = await extractor.extract(details.url);
            }
        } catch (extractError) {
            console.error('Content extraction failed:', extractError);
            extractedContent = {
                title: 'Extraction failed',
                content: 'Could not extract content from this page.',
                type: 'error'
            };
        }

        console.log('Extracted content:', {
            url: details.url,
            domain: ruleKey,
            extractedContent: extractedContent
        });

        await storageHelper.set({
            tempExtractedContent: {
                url: details.url,
                domain: ruleKey,
                timestamp: Date.now(),
                extractedContent: extractedContent
            }
        });

        const conversationUrl = browser.runtime.getURL("pages/conversation.html") +
            `?domain=${encodeURIComponent(ruleKey)}` +
            `${blockedSites[ruleKey]?.reason ? `&reason=${encodeURIComponent(blockedSites[ruleKey].reason)}` : ''}` +
            `&url=${encodeURIComponent(details.url)}`;

        await browser.tabs.update(details.tabId, {
            url: conversationUrl
        });

        return { cancel: true };
    } catch (error) {
        console.error("Request handling failed:", error);
        return { cancel: true };
    }
}




/*
async function extractPageContent(tabId, url) {
    try {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.responseType = 'document';
            xhr.open('GET', url, true);
            xhr.onload = () => {
                if (xhr.responseXML) {
                    const doc = xhr.responseXML;
                    const content = {
                        url: url,
                        title: doc.title,
                        text: doc.body.textContent.trim(),
                        // Try to get main content, fallback to body if not found
                        mainContent: doc.querySelector('main, article, .content, #content')?.textContent.trim() 
                            || doc.body.textContent.trim()
                    };
                    resolve(content);
                } else {
                    reject(new Error('Could not parse page content'));
                }
            };
            xhr.onerror = () => reject(new Error('Failed to fetch page'));
            xhr.send();
        });
    } catch (error) {
        console.error('Content extraction failed:', error);
        return null;
    }
}
*/

function updateBlockedSites() {
    console.log("Updating blocked sites - current state:", blockedSites);

    // Remove existing listener if it exists
    if (currentListener) {
        console.log("Removing existing listener");
        browser.webRequest.onBeforeRequest.removeListener(currentListener);
        currentListener = null;
    }

    // Only proceed if there are sites to block
    if (Object.keys(blockedSites).length > 0) {
        const patterns = getBlockedUrlPatterns();
        console.log("Setting up blocking with patterns:", patterns);

        try {
            // Add new listener
            browser.webRequest.onBeforeRequest.addListener(
                handleRequest,
                {
                    urls: patterns,
                    types: ["main_frame"]  // Only block main page loads
                },
                ["blocking"]
            );
            currentListener = handleRequest;
            console.log("Blocking listener registered successfully");
        } catch (error) {
            console.error("Failed to register blocking listener:", error);
        }
    } else {
        console.log("No sites to block, listener removed");
    }
}

// Listen for storage changes to update blocked sites
browser.storage.onChanged.addListener((changes, areaName) => {
    if ((areaName === 'sync' || areaName === 'local') && changes.blockedSites) {
        console.log(`Storage changed in ${areaName}:`, changes.blockedSites);
        blockedSites = changes.blockedSites.newValue || {};
        updateBlockedSites();
    }
    
    // Also update bypassList if it changes
    if ((areaName === 'sync' || areaName === 'local') && changes.bypassList) {
        console.log(`BypassList changed in ${areaName}:`, changes.bypassList);
        bypassList = changes.bypassList.newValue || {};
    }
});

// Single message listener for Claude API and bypass management
browser.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'claudeAPI') {
        try {
            // Get the API key directly from storage
            const data = await storageHelper.get(['apiKey']);
            const apiKey = data.apiKey;

            if (!apiKey) {
                throw new Error('API key not found. Please set your Claude API key in the extension settings.');
            }

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify(message.data)
            });

            const jsonResponse = await response.json();
            if (!response.ok) {
                throw new Error(JSON.stringify(jsonResponse));
            }
            return jsonResponse;
        } catch (error) {
            return { type: 'error', error: error.message };
        }
    } // In the message listener where 'grantBypass' is handled
    else if (message.type === 'grantBypass') {
        await addBypass(message.domain, message.duration);
        // Now also log the grant with duration
        await logAccessAttempt(message.domain, true, message.duration);
        return { success: true };
    } else if (message.type === 'getAccessHistory') {
        const data = await storageHelper.get('accessHistory');
        return data.accessHistory?.[message.domain] || [];
    } else if (message.type === 'extractContent') {
        return await extractPageContent(message.tabId, message.url);
    }
});

// // Load the blockedSites and bypassList from storage
// browser.storage.onChanged.addListener((changes, area) => {
//     // Use the storage change event to update our cached lists
//     if (changes.blockedSites) {
//         blockedSites = changes.blockedSites.newValue || {};
//     }
//     if (changes.bypassList) {
//         bypassList = changes.bypassList.newValue || {};
//     }
// });

// // Initial load of data
// storageHelper.get(['blockedSites', 'bypassList']).then(result => {
//     blockedSites = result.blockedSites || {};
//     bypassList = result.bypassList || {};
//     console.log('Loaded blocked sites:', Object.keys(blockedSites));
// });

// // Update all other storage.local calls to use storageHelper
// async function checkUrl(url) {
//     // Reload blocked sites for fresh data
//     const result = await storageHelper.get(['blockedSites']);
//     blockedSites = result.blockedSites || {};
    
//     try {
//         const parsedUrl = new URL(url);
//         const domain = parsedUrl.hostname.replace('www.', '');
        
//         // Check if the domain contains any of our blocked domains
//         const matchingBlockedDomain = Object.keys(blockedSites).find(blockedDomain =>
//             domain.includes(blockedDomain)
//         );
        
//         if (!matchingBlockedDomain) {
//             return false;
//         }
        
//         // Check if there's an active bypass
//         if (hasActiveBypass(matchingBlockedDomain)) {
//             console.log(`Active bypass found for ${matchingBlockedDomain}`);
//             return false;
//         }
        
//         return true;
//     } catch (error) {
//         console.error("Error checking URL:", error);
//         return false;
//     }
// }

// // Update URL handling
// function handleUpdated(tabId, changeInfo, tabInfo) {
//     if (changeInfo.url) {
//         checkUrl(changeInfo.url).then(shouldBlock => {
//             if (shouldBlock) {
//                 console.log("Blocked URL detected in tab:", tabId, changeInfo.url);
                
//                 // Parse the URL to get domain
//                 try {
//                     const parsedUrl = new URL(changeInfo.url);
//                     const domain = parsedUrl.hostname.replace('www.', '');
                    
//                     // Get blocked site information
//                     const blockedSite = Object.keys(blockedSites).find(site => domain.includes(site));
//                     const reason = blockedSites[blockedSite]?.reason || "This site is blocked";
                    
//                     // Create the conversation URL with context
//                     const conversationUrl = browser.runtime.getURL(
//                         `pages/conversation.html?domain=${encodeURIComponent(domain)}&reason=${encodeURIComponent(reason)}`
//                     );
                    
//                     // Update the tab to show the conversation page
//                     browser.tabs.update(tabId, { url: conversationUrl });
                    
//                     // Log the access attempt
//                     logAccessAttempt(domain, false);
//                 } catch (error) {
//                     console.error("Error handling blocked URL:", error);
//                 }
//             }
//         });
//     }
// }

// // Register the tab update listener
// browser.tabs.onUpdated.addListener(handleUpdated);

// // Add a domain to the bypass list
// async function addToBypassList(domain, duration) {
//     // Calculate expiry time
//     const expiryTime = Date.now() + (duration * 60 * 1000);
//     bypassList[domain] = { expiryTime };
    
//     // Save to storage
//     await storageHelper.set({ bypassList });
//     console.log(`Added ${domain} to bypass list until ${new Date(expiryTime)}`);
// }

// // Track access history
// async function recordAccessAttempt(domain, granted, duration = null) {
//     const data = await storageHelper.get('accessHistory');
//     const history = data.accessHistory || {};
    
//     // Initialize domain entry if it doesn't exist
//     if (!history[domain]) {
//         history[domain] = [];
//     }
    
//     // Add new entry
//     history[domain].push({
//         timestamp: Date.now(),
//         granted: granted,
//         duration: duration,
//     });
    
//     // Trim to last 20 entries per domain
//     if (history[domain].length > 20) {
//         history[domain] = history[domain].slice(-20);
//     }
    
//     // Save back to storage
//     await storageHelper.set({ accessHistory: history });
// }

// // Clean up expired bypass entries
// async function cleanupBypassList() {
//     let changed = false;
//     const now = Date.now();
    
//     Object.keys(bypassList).forEach(domain => {
//         if (bypassList[domain].expiryTime < now) {
//             console.log(`Removing expired bypass for ${domain}`);
//             delete bypassList[domain];
//             changed = true;
//         }
//     });
    
//     if (changed) {
//         await storageHelper.set({ bypassList });
//     }
// }

// // Remove domain from bypass list
// async function removeFromBypassList(domain) {
//     if (bypassList[domain]) {
//         delete bypassList[domain];
//         await storageHelper.set({ bypassList });
//         console.log(`Removed ${domain} from bypass list`);
//     }
// }

// // Extract content if enabled
// async function extractContentFromTab(tab) {
//     // Check if content extraction is enabled
//     const data = await storageHelper.get(['enableContentExtraction']);
//     const enableContentExtraction = data.enableContentExtraction !== undefined ? 
//         data.enableContentExtraction : true;
    
//     if (!enableContentExtraction) {
//         console.log('Content extraction disabled - page content will not be included');
//         return {
//             title: 'Content Hidden',
//             content: 'Page content is intentionally hidden from LLM per user settings.',
//             type: 'hidden'
//         };
//     }
    
//     try {
//         // Execute script to extract content from the page
//         const results = await browser.tabs.executeScript(tab.id, {
//             code: `
//                 (function() {
//                     const pageData = {
//                         title: document.title,
//                         url: window.location.href,
//                         content: document.body.innerText.substring(0, 5000),
//                         meta: document.querySelector('meta[name="description"]')?.content || ''
//                     };
//                     return pageData;
//                 })();
//             `
//         });
        
//         // Return the extracted content if available
//         if (results && results[0]) {
//             return results[0];
//         }
//     } catch (error) {
//         console.error('Error extracting content from tab:', error);
//     }
    
//     // Return a default object if extraction failed
//     return {
//         title: 'Content Extraction Failed',
//         content: 'Unable to extract content from the page.',
//         type: 'error'
//     };
// }

// // Save extracted content temporarily
// async function saveExtractedContent(extractedContent) {
//     await storageHelper.set({
//         tempExtractedContent: {
//             timestamp: Date.now(),
//             extractedContent
//         }
//     });
// }

// // Check if API key exists
// async function hasApiKey() {
//     const data = await storageHelper.get(['apiKey']);
//     return !!data.apiKey;
// }

// // Get access history for popup
// async function getAccessHistory() {
//     const data = await storageHelper.get('accessHistory');
//     return data.accessHistory || {};
// }

// // Check browser.runtime.onInstalled to set default storage
// browser.runtime.onInstalled.addListener(() => {
//     console.log("Extension installed or updated");
    
//     // First check if we already have blocked sites
//     storageHelper.get(['blockedSites']).then(result => {
//         // Initialize with empty object if not present
//         if (!result.blockedSites) {
//             storageHelper.set({ 
//                 blockedSites: {},
//                 bypassList: {},
//                 accessHistory: {}
//             }).then(() => {
//                 console.log("Initialized default storage");
//             });
//         } else {
//             console.log("Existing blocked sites found, not initializing defaults");
//         }
//     });
    
//     // Clean up any expired bypasses on startup
//     cleanupBypassList();
// });

// Handle browser action click to open settings in a new tab
browser.browserAction.onClicked.addListener(() => {
    browser.tabs.create({
        url: browser.runtime.getURL("pages/settings.html")
    });
});

// Track bypassed tabs
var bypassedTabs = new Map();

// Track tabs that are allowed through bypass
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        const url = changeInfo.url.toLowerCase();
        // Only track if it's a bypassed domain
        Object.entries(bypassList).forEach(([domain, bypass]) => {
            if (url.includes(domain)) {
                bypassedTabs.set(tabId, { domain, expiresAt: bypass.expiresAt });
            }
        });
    }
});

// Clean up tracking when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
    bypassedTabs.delete(tabId);
});

// Handle bypass expiration
async function handleBypassExpiration(domain) {
    console.log(`Bypass expired for ${domain}`);
    
    // Remove from bypass list
    delete bypassList[domain];
    await storageHelper.set({ bypassList });
    
    // Find all tabs for this domain
    const tabs = await browser.tabs.query({});
    const expiredTabs = tabs.filter(tab => {
        const trackingInfo = bypassedTabs.get(tab.id);
        return trackingInfo && trackingInfo.domain === domain;
    });
    
    // Redirect each expired tab
    for (const tab of expiredTabs) {
        const conversationUrl = browser.runtime.getURL("pages/conversation.html") +
            `?domain=${encodeURIComponent(domain)}${blockedSites[domain]?.reason ? `&reason=${encodeURIComponent(blockedSites[domain].reason)}` : ''}&expired=true`;
            
        await browser.tabs.update(tab.id, { url: conversationUrl });
        bypassedTabs.delete(tab.id);
    }
}

