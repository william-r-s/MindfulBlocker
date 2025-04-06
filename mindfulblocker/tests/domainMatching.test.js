// Test suite for domain matching rules
// Import the matchesDomain function
// In a browser environment this would be: const { matchesDomain } = window;
// For Node.js testing this would be: const { matchesDomain } = require('../domainMatcher');

function testDomainMatching() {
    // Use the imported function if available, otherwise use the one defined here
    const matcher = typeof matchesDomain !== 'undefined' ? matchesDomain : null;
    
    if (!matcher) {
        console.error("matchesDomain function not found. Make sure domainMatcher.js is loaded before this script.");
        return;
    }
    
    const testCases = [
        {
            name: "Exact domain match",
            rule: "reddit.com",
            url: "https://reddit.com",
            shouldMatch: true
        },
        {
            name: "Subdomain match",
            rule: "reddit.com",
            url: "https://www.reddit.com",
            shouldMatch: true
        },
        {
            name: "Path match",
            rule: "reddit.com",
            url: "https://reddit.com/r/popular",
            shouldMatch: true
        },
        {
            name: "Different protocol",
            rule: "reddit.com",
            url: "http://reddit.com",
            shouldMatch: true
        },
        {
            name: "Multiple rules",
            rule: "reddit.com, twitter.com",
            url: "https://twitter.com",
            shouldMatch: true
        },
        {
            name: "No match - different domain",
            rule: "reddit.com",
            url: "https://twitter.com",
            shouldMatch: false
        },
        {
            name: "No match - similar domain",
            rule: "x.com",
            url: "https://slatestarcodex.com",
            shouldMatch: false
        },
        {
            name: "No match - subdomain of similar domain",
            rule: "x.com",
            url: "https://x.slatestarcodex.com",
            shouldMatch: false
        },
        {
            name: "No match - similar domain with x.com",
            rule: "x.com",
            url: "https://slatestarcodex.com",
            shouldMatch: false
        },
        {
            name: "No match - domain contains rule",
            rule: "x.com",
            url: "https://example.com",
            shouldMatch: false
        },
        // Additional test cases
        {
            name: "Match - specific subdomain",
            rule: "news.ycombinator.com",
            url: "https://news.ycombinator.com",
            shouldMatch: true
        },
        {
            name: "No match - different subdomain",
            rule: "news.ycombinator.com",
            url: "https://blog.ycombinator.com",
            shouldMatch: false
        },
        {
            name: "Match - IP address",
            rule: "127.0.0.1",
            url: "http://127.0.0.1",
            shouldMatch: true
        },
        {
            name: "Match - path in pattern",
            rule: "reddit.com/r/popular",
            url: "https://reddit.com/r/popular",
            shouldMatch: true
        },
        {
            name: "URL with port number",
            rule: "localhost",
            url: "http://localhost:3000",
            shouldMatch: true
        }
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach(test => {
        const result = matcher(test.rule, test.url);
        if (result === test.shouldMatch) {
            passed++;
            console.log(`✅ ${test.name}`);
        } else {
            failed++;
            console.log(`❌ ${test.name}`);
            console.log(`   Expected: ${test.shouldMatch}`);
            console.log(`   Got: ${result}`);
            console.log(`   Rule: ${test.rule}`);
            console.log(`   URL: ${test.url}`);
        }
    });

    console.log(`\nTest Summary:`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${testCases.length}`);
    
    // Return results for programmatic use
    return {
        passed,
        failed,
        total: testCases.length,
        success: failed === 0
    };
}

// Only define the function if it's not already available (for testing)
if (typeof window === 'undefined' || !window.matchesDomain) {
    console.log("Using local implementation of matchesDomain for testing");
    // Domain matching function (same as in domainMatcher.js)
    function matchesDomain(rule, url) {
        // Remove protocol and www. from the URL for matching
        const urlForMatching = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
        
        // Split rules and clean them
        const patterns = rule.split(',').map(pattern => 
            pattern.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '')
        );

        // Check if any pattern matches
        return patterns.some(pattern => {
            // Split pattern into parts (e.g., "reddit.com" -> ["reddit", "com"])
            const patternParts = pattern.split('.');
            
            // Split URL into parts (handle paths too)
            const urlPartsWithPath = urlForMatching.split('.');
            // Only use domain parts (before any path)
            const firstPathPartIndex = urlPartsWithPath.findIndex(part => part.includes('/'));
            const urlParts = firstPathPartIndex > 0 
                ? [...urlPartsWithPath.slice(0, firstPathPartIndex), 
                   urlPartsWithPath[firstPathPartIndex].split('/')[0]]
                : urlPartsWithPath;
            
            // If pattern has more parts than URL, it can't match
            if (patternParts.length > urlParts.length) {
                return false;
            }
            
            // Check if the last N parts match exactly (domain parts)
            const lastNUrlParts = urlParts.slice(-patternParts.length);
            return patternParts.every((part, index) => part === lastNUrlParts[index]);
        });
    }
}

// Create a script element to run the test
function createTestRunner() {
    const testButton = document.createElement('button');
    testButton.textContent = 'Run Domain Matching Tests';
    testButton.style.position = 'fixed';
    testButton.style.bottom = '20px';
    testButton.style.right = '20px';
    testButton.style.zIndex = '9999';
    testButton.style.padding = '10px';
    testButton.style.backgroundColor = '#0060df';
    testButton.style.color = 'white';
    testButton.style.border = 'none';
    testButton.style.borderRadius = '4px';
    testButton.style.cursor = 'pointer';
    
    testButton.addEventListener('click', () => {
        console.clear();
        console.log('Running domain matching tests...');
        const results = testDomainMatching();
        
        // Display results
        const resultDiv = document.createElement('div');
        resultDiv.style.position = 'fixed';
        resultDiv.style.top = '50%';
        resultDiv.style.left = '50%';
        resultDiv.style.transform = 'translate(-50%, -50%)';
        resultDiv.style.padding = '20px';
        resultDiv.style.backgroundColor = results.success ? '#d4edda' : '#f8d7da';
        resultDiv.style.border = `1px solid ${results.success ? '#c3e6cb' : '#f5c6cb'}`;
        resultDiv.style.borderRadius = '4px';
        resultDiv.style.zIndex = '10000';
        resultDiv.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        resultDiv.style.maxWidth = '80%';
        
        // Create and append elements instead of using innerHTML
        const heading = document.createElement('h3');
        heading.textContent = 'Test Results';
        resultDiv.appendChild(heading);
        
        const passedPara = document.createElement('p');
        passedPara.textContent = `Passed: ${results.passed}`;
        resultDiv.appendChild(passedPara);
        
        const failedPara = document.createElement('p');
        failedPara.textContent = `Failed: ${results.failed}`;
        resultDiv.appendChild(failedPara);
        
        const totalPara = document.createElement('p');
        totalPara.textContent = `Total: ${results.total}`;
        resultDiv.appendChild(totalPara);
        
        const statusPara = document.createElement('p');
        statusPara.textContent = results.success ? '✅ All tests passed!' : '❌ Some tests failed!';
        resultDiv.appendChild(statusPara);
        
        const closeButton = document.createElement('button');
        closeButton.id = 'closeResults';
        closeButton.textContent = 'Close';
        closeButton.style.padding = '5px 10px';
        closeButton.style.background = '#0060df';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '4px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.marginTop = '10px';
        resultDiv.appendChild(closeButton);
        
        document.body.appendChild(resultDiv);
        
        document.getElementById('closeResults').addEventListener('click', () => {
            resultDiv.remove();
        });
    });
    
    document.body.appendChild(testButton);
}

// Run tests in browser context if this script is loaded in a page
if (typeof window !== 'undefined') {
    // Create a test runner button when the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createTestRunner);
    } else {
        createTestRunner();
    }
} else {
    // Run tests directly in Node.js environment
    testDomainMatching();
} 