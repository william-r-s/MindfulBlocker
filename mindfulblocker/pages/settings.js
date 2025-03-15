// Initialize variables
let blockedSites = {};
let keyStatus = {
    exists: false
};
let enableContentExtraction = true; // Default to enabled

// Load settings when page opens
document.addEventListener('DOMContentLoaded', loadSettings);

async function loadSettings() {
    // Load blocked sites and check API key status
    const data = await storageHelper.get(['blockedSites', 'apiKey', 'enableContentExtraction']);
    blockedSites = data.blockedSites || {};
    keyStatus.exists = !!data.apiKey;
    enableContentExtraction = data.enableContentExtraction !== undefined ? data.enableContentExtraction : true;

    // Set checkbox state
    const checkbox = document.getElementById('enableContentExtraction');
    checkbox.checked = enableContentExtraction;

    // Add event listener to save preference immediately when toggled
    checkbox.addEventListener('change', async function () {
        const isEnabled = this.checked;
        enableContentExtraction = isEnabled;

        try {
            await storageHelper.set({ enableContentExtraction: isEnabled });
            showAlert('Content setting saved', 'success');
        } catch (error) {
            showAlert('Failed to save setting: ' + error.message, 'error');
            // Revert checkbox if save failed
            this.checked = !isEnabled;
        }
    });

    updateKeyStatusUI();
    updateBlockedSitesList();
    updateAccessHistory();
}

function updateKeyStatusUI() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('keyStatus');
    const newKeyForm = document.getElementById('newKeyForm');
    const existingKeyActions = document.getElementById('existingKeyActions');

    if (!keyStatus.exists) {
        statusDot.className = 'status-dot';
        statusText.textContent = 'No API key set';
        newKeyForm.style.display = 'block';
        existingKeyActions.style.display = 'none';
    } else {
        statusDot.className = 'status-dot active';
        statusText.textContent = 'API key active';
        newKeyForm.style.display = 'none';
        existingKeyActions.style.display = 'block';
    }
}

// Save new API key
document.getElementById('saveKey').addEventListener('click', async function () {
    const apiKey = document.getElementById('apiKey').value.trim();

    try {
        // Validate inputs
        if (!apiKey.startsWith('sk-')) {
            throw new Error('Invalid API key format. Should start with "sk-"');
        }

        // Save key directly to storage
        await storageHelper.set({ apiKey });

        // Update status
        keyStatus.exists = true;
        updateKeyStatusUI();

        // Clear form
        document.getElementById('apiKey').value = '';

        showAlert('API key saved successfully', 'success');
    } catch (error) {
        showAlert(`Error: ${error.message}`, 'error');
    }
});

// Change API key
document.getElementById('changeKey').addEventListener('click', function () {
    keyStatus.exists = false;
    updateKeyStatusUI();
});

// Remove API key
document.getElementById('removeKey').addEventListener('click', async function () {
    if (confirm('Are you sure you want to remove your API key?')) {
        await storageHelper.remove(['apiKey']);
        keyStatus.exists = false;
        updateKeyStatusUI();
        showAlert('API key removed', 'success');
    }
});

// Add new blocked site
document.getElementById('addSite').addEventListener('click', async function () {
    const siteInput = document.getElementById('newSite');
    const reasonInput = document.getElementById('blockReason');
    const patterns = siteInput.value.trim().toLowerCase();
    const reason = reasonInput.value.trim();

    if (!patterns) {
        alert('Please enter at least one site pattern');
        return;
    }

    // Split and clean patterns
    const cleanedPatterns = patterns.split(',')
        .map(p => p.trim())
        .map(p => p.replace(/^https?:\/\/(www\.)?/, '')) // Remove any protocol and www if user included them
        .filter(p => p); // Remove empty patterns

    if (cleanedPatterns.length === 0) {
        alert('Please enter at least one valid pattern');
        return;
    }

    // Basic validation - ensure each pattern has at least one dot and no spaces
    for (const pattern of cleanedPatterns) {
        if (!pattern.includes('.')) {
            alert(`Invalid pattern: ${pattern}\nPattern must include a domain (e.g., reddit.com, reddit.com/r/popular)`);
            return;
        }
        if (pattern.includes(' ')) {
            alert(`Invalid pattern: ${pattern}\nPattern cannot contain spaces`);
            return;
        }
    }

    // Join patterns back together
    const finalPatterns = cleanedPatterns.join(', ');

    // Add to blocked sites
    blockedSites[finalPatterns] = {
        reason: reason || undefined, // Only include reason if it's not empty
        dateAdded: Date.now()
    };

    // Save to storage
    await storageHelper.set({ blockedSites });

    // Update UI
    siteInput.value = '';
    reasonInput.value = '';
    updateBlockedSitesList();
    showAlert(`Added blocking rule for: ${finalPatterns}`, 'success');
});

// Update the blocked sites list in the UI
function updateBlockedSitesList() {
    const container = document.getElementById('sitesList');
    container.innerHTML = '';

    Object.entries(blockedSites).forEach(([patterns, data]) => {
        const entry = document.createElement('div');
        entry.className = 'site-entry';
        const date = new Date(data.dateAdded).toLocaleDateString();

        // Create site information elements
        const infoDiv = document.createElement('div');
        
        const siteName = document.createElement('strong');
        siteName.textContent = patterns.split(',').map(p => p.trim()).join(', ');
        
        const reason = document.createElement('p');
        reason.textContent = `Reason: ${data.reason}`;
        
        const dateElement = document.createElement('small');
        dateElement.textContent = `Added: ${date}`;
        
        // Create remove button
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-site';
        removeButton.textContent = 'Remove';
        removeButton.dataset.patterns = patterns;
        
        // Append all elements
        infoDiv.appendChild(siteName);
        infoDiv.appendChild(reason);
        infoDiv.appendChild(dateElement);
        
        entry.appendChild(infoDiv);
        entry.appendChild(removeButton);

        // Directly add event listener to the button variable
        removeButton.addEventListener('click', () => removeSite(patterns));

        container.appendChild(entry);
    });
}

// Remove a blocked site
async function removeSite(patterns) {
    if (confirm(`Are you sure you want to unblock ${patterns}?`)) {
        delete blockedSites[patterns];
        await storageHelper.set({ blockedSites });
        updateBlockedSitesList();
    }
}


async function updateAccessHistory() {
    const container = document.getElementById('accessHistoryList');
    const data = await storageHelper.get('accessHistory');
    const history = data.accessHistory || {};

    // Clear the container safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    for (const [site, attempts] of Object.entries(history)) {
        const siteHeader = document.createElement('h4');
        siteHeader.textContent = site;
        container.appendChild(siteHeader);

        attempts.slice(-10).reverse().forEach(attempt => {
            const entry = document.createElement('div');
            entry.className = 'history-entry granted';

            // Create timestamp div
            const timestampDiv = document.createElement('div');
            timestampDiv.textContent = new Date(attempt.timestamp).toLocaleString();

            // Create access info div
            const accessDiv = document.createElement('div');
            accessDiv.textContent = `✅ Access granted for ${attempt.duration} minutes`;

            // Append children
            entry.appendChild(timestampDiv);
            entry.appendChild(accessDiv);

            container.appendChild(entry);
        });
    }
}

// Clear access history
document.getElementById('clearHistory').addEventListener('click', async function () {
    if (confirm('Are you sure you want to clear all access history?')) {
        await storageHelper.set({ accessHistory: {} });
        updateAccessHistory();
        showAlert('Access history cleared', 'success');
    }
});

// Load the system prompt template from storage or use default
async function loadSystemPromptTemplate() {
    const data = await storageHelper.get('systemPromptTemplate');
    const template = data.systemPromptTemplate || window.DEFAULT_SYSTEM_PROMPT;
    document.getElementById('systemPromptTemplate').value = template;
}

// Save the system prompt template
document.getElementById('saveTemplate').addEventListener('click', async function () {
    try {
        const template = document.getElementById('systemPromptTemplate').value.trim();

        // Validate that template contains required placeholders
        const requiredPlaceholders = ['{{domain}}', '{{blockReason}}'];
        const missingPlaceholders = requiredPlaceholders.filter(placeholder =>
            !template.includes(placeholder)
        );

        if (missingPlaceholders.length > 0) {
            throw new Error(`Template must include: ${missingPlaceholders.join(', ')}`);
        }

        await storageHelper.set({ systemPromptTemplate: template });

        const statusElement = document.getElementById('templateStatus');
        statusElement.className = 'success';
        statusElement.textContent = 'Template saved successfully!';

        setTimeout(() => {
            statusElement.textContent = '';
        }, 3000);
    } catch (error) {
        const statusElement = document.getElementById('templateStatus');
        statusElement.className = 'error';
        statusElement.textContent = error.message;
    }
});

// Reset to default template
document.getElementById('resetTemplate').addEventListener('click', async function () {
    if (confirm('Are you sure you want to reset to the default template?')) {
        document.getElementById('systemPromptTemplate').value = window.DEFAULT_SYSTEM_PROMPT;
        await storageHelper.set({ systemPromptTemplate: window.DEFAULT_SYSTEM_PROMPT });

        const statusElement = document.getElementById('templateStatus');
        statusElement.className = 'success';
        statusElement.textContent = 'Template reset to default!';

        setTimeout(() => {
            statusElement.textContent = '';
        }, 3000);
    }
});

// Load the system prompt template when the page loads
loadSettings().then(() => {
    loadSystemPromptTemplate();
});

// Helper function to show alerts
function showAlert(message, type = 'info') {
    const alertBox = document.createElement('div');
    alertBox.className = `alert alert-${type}`;
    alertBox.style.cssText = `
        position: fixed;
        bottom: 15px;
        right: 15px;
        padding: 8px 15px;
        border-radius: 4px;
        background-color: ${type === 'success' ? '#d4edda' : '#f8d7da'};
        color: ${type === 'success' ? '#155724' : '#721c24'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        z-index: 1000;
        font-size: 14px;
    `;
    alertBox.textContent = message;

    document.body.appendChild(alertBox);

    // Auto-remove after 1.5 seconds
    setTimeout(() => {
        alertBox.style.opacity = '0';
        alertBox.style.transition = 'opacity 0.5s ease';
        setTimeout(() => alertBox.remove(), 500);
    }, 1500);
}
