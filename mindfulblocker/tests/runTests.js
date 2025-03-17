#!/usr/bin/env node

/**
 * Node.js test runner for MindfulBlocker domain matching tests
 * 
 * Run with: node runTests.js
 */

// Import the domain matcher
const { matchesDomain } = require('../domainMatcher');

// Define test cases
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
    },
    // Complex test cases
    {
        name: "Match - domain with specific path pattern",
        rule: "github.com/mindfulblocker",
        url: "https://github.com/mindfulblocker/issues",
        shouldMatch: true
    },
    {
        name: "No match - similar path",
        rule: "github.com/mindfulblocker",
        url: "https://github.com/mindfulblockerapp",
        shouldMatch: false
    },
    {
        name: "Match - domain with query parameters",
        rule: "example.com/search",
        url: "https://example.com/search?q=test&page=1",
        shouldMatch: true
    },
    {
        name: "No match - very similar domain with different TLD",
        rule: "example.com",
        url: "https://example.org",
        shouldMatch: false
    },
    {
        name: "No match - domain as part of a longer string", 
        rule: "x.com",
        url: "https://thisisnotx.com",
        shouldMatch: false
    },
    {
        name: "Match - complex subdomain",
        rule: "sub.complex.example.com",
        url: "https://sub.complex.example.com",
        shouldMatch: true
    },
    {
        name: "No match - partial subdomain match",
        rule: "sub.complex.example.com",
        url: "https://another.complex.example.com",
        shouldMatch: false
    }
];

// Colors for terminal output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m"
};

// Run tests
function runTests() {
    console.log(`${colors.bright}${colors.blue}Running MindfulBlocker Domain Matching Tests${colors.reset}\n`);
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach(test => {
        const result = matchesDomain(test.rule, test.url);
        if (result === test.shouldMatch) {
            passed++;
            console.log(`${colors.green}✓${colors.reset} ${test.name}`);
        } else {
            failed++;
            console.log(`${colors.red}✗${colors.reset} ${test.name}`);
            console.log(`  ${colors.dim}Expected: ${test.shouldMatch}`);
            console.log(`  Got: ${result}`);
            console.log(`  Rule: ${test.rule}`);
            console.log(`  URL: ${test.url}${colors.reset}`);
        }
    });
    
    console.log(`\n${colors.bright}Test Summary:${colors.reset}`);
    if (passed > 0) {
        console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
    }
    if (failed > 0) {
        console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
    }
    console.log(`Total: ${testCases.length}`);
    
    if (failed === 0) {
        console.log(`\n${colors.green}${colors.bright}All tests passed!${colors.reset}`);
        return 0; // Success exit code
    } else {
        console.log(`\n${colors.red}${colors.bright}Some tests failed!${colors.reset}`);
        return 1; // Failure exit code
    }
}

// Run the tests and set process exit code
process.exitCode = runTests(); 