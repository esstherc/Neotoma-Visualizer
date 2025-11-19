// Custom Select Implementation for Taxon Group Dropdown

function initCustomSelect() {
    const selectElement = document.getElementById('taxagroupSelect');
    const customSelect = document.querySelector('.custom-select');
    const trigger = document.querySelector('.custom-select-trigger');
    const optionsContainer = document.querySelector('.custom-options');

    // Toggle dropdown
    trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        customSelect.classList.toggle('open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
        customSelect.classList.remove('open');
    });

    // Sync custom select with original select
    function syncCustomSelect() {
        const options = Array.from(selectElement.options);
        const selectedValue = selectElement.value;
        
        // Update trigger text
        const selectedOption = options.find(opt => opt.value === selectedValue);
        if (selectedOption) {
            trigger.textContent = selectedOption.textContent;
        } else if (options.length > 0) {
            // Fallback: use first option if selected option not found
            trigger.textContent = options[0].textContent;
        }

        // Update options
        optionsContainer.innerHTML = '';
        options.forEach(option => {
            // Include all options, including those with empty values (like "Major Groups")
            const customOption = document.createElement('div');
            customOption.className = 'custom-option';
            if (option.value === selectedValue) {
                customOption.classList.add('selected');
            }
            customOption.textContent = option.textContent;
            customOption.dataset.value = option.value;

            customOption.addEventListener('click', function(e) {
                e.stopPropagation();
                selectElement.value = this.dataset.value;
                
                // Trigger change event on original select
                const event = new Event('change', { bubbles: true });
                selectElement.dispatchEvent(event);
                
                // Update UI
                syncCustomSelect();
                customSelect.classList.remove('open');
            });

            optionsContainer.appendChild(customOption);
        });
    }

    // Watch for changes to the original select (when options are loaded)
    const observer = new MutationObserver(syncCustomSelect);
    observer.observe(selectElement, { childList: true, subtree: true });

    // Also sync when value changes
    selectElement.addEventListener('change', syncCustomSelect);

    // Initial sync
    syncCustomSelect();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCustomSelect);
} else {
    initCustomSelect();
}

