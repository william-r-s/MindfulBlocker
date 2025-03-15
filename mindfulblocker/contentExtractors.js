const extractors = {

    'default': {
        type: 'default',
        canHandle: (url) => true,
        // This extractor is inspired by screen reader technology, but simplified to focus on content
        // It preserves semantic structure while removing UI element labels
        extract: async (url) => {
            try {
                const response = await fetch(url);
                const text = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');

                // Use the screen reader parser but keep the type as 'default'
                const content = parseNodeForScreenReader(doc.body);

                return {
                    title: doc.title || url,
                    content: content,
                    type: 'structured'
                };
            } catch (error) {
                console.error('Default extraction failed:', error);
                return {
                    title: url,
                    content: 'Content extraction failed',
                    type: 'structured'
                };
            }
        }
    }
};

/**
 * Parses a DOM node recursively in a way inspired by screen readers, but simplified for content focus
 * This function is used by both the 'default' and 'screenReader' extractors to provide
 * semantically structured content that preserves the document hierarchy while
 * focusing on the actual content rather than UI element descriptions.
 * 
 * @param {Node} node - The DOM node to parse
 * @param {Array} output - Array for accumulated text content
 * @param {Number} level - Current heading level (for context)
 * @returns {String} - Content-focused text representation
 */
function parseNodeForScreenReader(node, output = [], level = 0) {
    if (!node) return '';

    // Skip hidden elements
    if (node.nodeType === Node.ELEMENT_NODE) {
        const ariaHidden = node.getAttribute('aria-hidden');
        if (ariaHidden === 'true') return '';

        // Skip elements generally hidden from screen readers
        const tagName = node.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'iframe', 'canvas', 'svg'].includes(tagName)) {
            return '';
        }

        // Check for role="presentation" which strips semantic meaning
        if (node.getAttribute('role') === 'presentation') {
            // Only process children, ignoring the semantic meaning of this element
            Array.from(node.childNodes).forEach(child => {
                parseNodeForScreenReader(child, output, level);
            });
            return output.join(' ');
        }

        // Handle specific element types
        switch (tagName) {
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                const headingText = node.textContent.trim();
                if (headingText) {
                    // Just include the heading text without labeling the level
                    output.push(headingText);
                }
                break;

            case 'a':
                if (node.hasAttribute('href')) {
                    const linkText = node.textContent.trim();
                    if (linkText) {
                        // Just include the link text without labeling it
                        output.push(linkText);
                    }
                } else {
                    // Process children for links without href
                    Array.from(node.childNodes).forEach(child => {
                        parseNodeForScreenReader(child, output, level);
                    });
                }
                break;

            case 'img':
                const alt = node.getAttribute('alt');
                if (alt && alt.trim()) {
                    // Only include images with alt text
                    output.push(`Image: ${alt.trim()}`);
                }
                // Skip unlabeled images entirely
                break;

            case 'button':
                const buttonText = node.textContent.trim();
                if (buttonText) {
                    // Just include the button text without labeling it
                    output.push(buttonText);
                }
                break;

            case 'input':
                const inputType = node.getAttribute('type') || 'text';
                const placeholder = node.getAttribute('placeholder') || '';
                const labelText = node.getAttribute('aria-label') ||
                    node.getAttribute('title') ||
                    placeholder;

                if (inputType === 'button' || inputType === 'submit') {
                    // Just include the button/input value without labeling it
                    if (node.value) {
                        output.push(node.value);
                    } else if (labelText) {
                        output.push(labelText);
                    }
                } else if (labelText) {
                    // Only include form field if it has a label, without field type prefix
                    output.push(labelText);
                }
                break;

            case 'select':
                const selectLabel = node.getAttribute('aria-label') || '';
                if (selectLabel) {
                    // Just include the dropdown label without labeling it
                    output.push(selectLabel);
                }
                break;

            case 'figure':
                // Process figure elements and their captions
                const figcaption = node.querySelector('figcaption');
                if (figcaption) {
                    const captionText = figcaption.textContent.trim();
                    if (captionText) {
                        // Include caption text without labeling it
                        output.push(captionText);
                    }
                }

                // Process other children of figure
                Array.from(node.childNodes).forEach(child => {
                    if (child.tagName !== 'FIGCAPTION') {
                        parseNodeForScreenReader(child, output, level);
                    }
                });
                break;

            case 'table':
                // Announce tables with their caption or summary
                const caption = node.querySelector('caption');
                const summary = node.getAttribute('summary');

                if (caption && caption.textContent.trim()) {
                    // Include the caption text without labeling it
                    output.push(caption.textContent.trim());
                } else if (summary) {
                    // Include the summary without labeling it
                    output.push(summary);
                }

                // Process table contents (simplified)
                Array.from(node.childNodes).forEach(child => {
                    parseNodeForScreenReader(child, output, level);
                });
                break;

            case 'ul':
                // Process list items without announcing the list type
                Array.from(node.children).forEach((child, index) => {
                    if (child.tagName.toLowerCase() === 'li') {
                        const listItemOutput = [];
                        parseNodeForScreenReader(child, listItemOutput, level);
                        if (listItemOutput.length > 0) {
                            output.push(`• ${listItemOutput.join(' ')}`);
                        }
                    }
                });
                break;

            case 'ol':
                // Process ordered list items without announcing the list type
                Array.from(node.children).forEach((child, index) => {
                    if (child.tagName.toLowerCase() === 'li') {
                        const listItemOutput = [];
                        parseNodeForScreenReader(child, listItemOutput, level);
                        if (listItemOutput.length > 0) {
                            output.push(`${index + 1}. ${listItemOutput.join(' ')}`);
                        }
                    }
                });
                break;

            case 'li':
                // List items are handled by ul/ol processing, just extract content
                Array.from(node.childNodes).forEach(child => {
                    parseNodeForScreenReader(child, output, level);
                });
                break;

            default:
                // Handle text for regular elements
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if it's a block element to add line breaks
                    const blockElements = ['div', 'p', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main'];
                    const isBlock = blockElements.includes(tagName);

                    // Process children
                    const childOutput = [];
                    Array.from(node.childNodes).forEach(child => {
                        parseNodeForScreenReader(child, childOutput, level);
                    });

                    if (childOutput.length > 0) {
                        if (isBlock && output.length > 0) {
                            // Add an empty string to represent a paragraph break for block elements
                            output.push(childOutput.join(' '));
                            output.push('');
                        } else {
                            output.push(childOutput.join(' '));
                        }
                    }
                }
                break;
        }
    } else if (node.nodeType === Node.TEXT_NODE) {
        // Process text nodes
        const text = node.textContent.trim();
        if (text) {
            output.push(text);
        }
    }

    // Cleanup the output - remove empty entries and collapse whitespace
    const result = output
        .filter(entry => entry.trim().length > 0)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n'); // Collapse multiple line breaks

    return result;
}

/**
 * Get the appropriate content extractor for a URL
 * Now simplified to always return the best extractor for the given URL
 * 
 * @param {string} url - The URL to extract content from
 * @returns {Object} - The extractor object
 */
function getExtractor(url) {
    const domain = new URL(url).hostname.replace('www.', '');
    // Default extractor for all other sites
    return extractors.default;
}

window.getExtractor = getExtractor;