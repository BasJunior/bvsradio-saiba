// Main JavaScript for BVS Radio site
document.addEventListener('DOMContentLoaded', function() {
    // Year in footer
    const yearSpan = document.getElementById('year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
    
    // Mobile menu toggle (if needed in future)
    // Search functionality
    const searchInput = document.getElementById('siteSearch');
    const searchResults = document.getElementById('searchResults');
    
    if (searchInput && searchResults) {
        searchInput.addEventListener('input', function() {
            const query = this.value.trim();
            if (query.length > 2) {
                // Show search results (simplified)
                searchResults.hidden = false;
                // In a real implementation, you'd fetch/search here
                searchResults.innerHTML = `
                    <li role="option">Searching for "${query}"...</li>
                `;
            } else {
                searchResults.hidden = true;
            }
        });
        
        // Hide results when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.hidden = true;
            }
        });
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Add active class to nav links based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav a, .footer-nav a').forEach(link => {
        if (link.getAttribute('href') === currentPage || 
            (currentPage === 'index.html' && link.getAttribute('href') === '')) {
            link.classList.add('active');
        }
    });
    
    // Initialize any tooltips or interactive elements
    // Initialize audio player if it exists on the page
    if (typeof AudioPlayer !== 'undefined') {
        // AudioPlayer is initialized in player.js
    }
});