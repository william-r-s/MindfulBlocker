// Domain matching function for MindfulBlocker
// This function checks if a URL matches a specific blocking rule pattern

/**
 * Check if a URL matches any pattern in a rule string
 * @param {string} rule - Comma-separated list of domain patterns
 * @param {string} url - The URL to check against the patterns
 * @returns {boolean} - true if the URL matches any pattern, false otherwise
 */
function matchesDomain(rule, url) {
    // Remove protocol from the URL for matching
    const urlWithoutProtocol = url.toLowerCase().replace(/^https?:\/\//, '');
    
    // Handle www. prefix separately
    const urlForMatching = urlWithoutProtocol.replace(/^www\./, '');
    
    // Split rules and clean them
    const patterns = rule.split(',').map(pattern => 
        pattern.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '')
    );

    // Check if any pattern matches
    return patterns.some(pattern => {
        // Check for exact match including path
        if (urlForMatching === pattern) {
            return true;
        }
        
        // Check for domain match with path
        if (pattern.includes('/')) {
            const patternParts = pattern.split('/');
            const patternDomain = patternParts[0];
            const patternPath = '/' + patternParts.slice(1).join('/');
            
            // Extract domain and path from URL
            const urlParts = urlForMatching.split('/');
            const urlDomain = urlParts[0].split(':')[0]; // Remove port if exists
            const urlPath = urlParts.length > 1 ? '/' + urlParts.slice(1).join('/') : '';
            
            // For path matching, we need to ensure it's an exact match or the URL path
            // starts with the pattern path followed by a slash or query parameter
            if (urlDomain === patternDomain) {
                // Exact path match
                if (urlPath === patternPath) {
                    return true;
                }
                
                // Path starts with pattern path followed by / or ? or #
                if (patternPath.length > 0 && 
                    (urlPath.startsWith(patternPath + '/') || 
                     urlPath.startsWith(patternPath + '?') || 
                     urlPath.startsWith(patternPath + '#'))) {
                    return true;
                }
            }
            
            return false;
        }
        
        // For domain-only patterns, extract just the domain portion from URL (without port)
        const urlDomain = urlForMatching.split('/')[0].split(':')[0];
        const patternDomain = pattern;
        
        // Split domains into parts
        const patternParts = patternDomain.split('.');
        const urlParts = urlDomain.split('.');
        
        // If pattern has more parts than URL, it can't match
        if (patternParts.length > urlParts.length) {
            return false;
        }
        
        // Check if the last N parts match exactly
        const lastNUrlParts = urlParts.slice(-patternParts.length);
        return patternParts.every((part, index) => part === lastNUrlParts[index]);
    });
}

// Make the function available for browser environments
if (typeof window !== 'undefined') {
    window.matchesDomain = matchesDomain;
}

// Make the function available for Node.js/module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { matchesDomain };
} 