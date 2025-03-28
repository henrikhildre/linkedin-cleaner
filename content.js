console.log("LinkedIn Feed Fun Blocker: Content script loaded.");

// --- Configuration ---
const MAX_SLIDES = 3; // Block posts with more slides/images than this
const MIN_DIFFERENT_EMOJI_BULLETS = 2; // Block if >= N *different* emoji bullets are found

// --- Selectors (UPDATED based on user input) ---
// Use the data attribute to identify individual posts
const FEED_UPDATE_SELECTOR = "[data-view-name='feed-full-update']";

// Selectors *within* a post (these might still need adjustment if structure changed)
const SLIDESHOW_INDICATOR_SELECTOR = ".ssplayer-topbar-details__preview, .ssplayer-topbar-details__full-screen, .ssplayer-pagination-length, .ssplayer-pagination-value";
const SLIDESHOW_ITEM_SELECTOR = ".carousel-slide"; // Updated for ssplayer
const POST_TEXT_SELECTOR = ".update-components-text, .feed-shared-update-v2__description";
const DOCUMENT_CONTAINER_SELECTOR = ".document-s-container";
const EMOJI_REGEX = /^\s*([\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}][\u{FE00}-\u{FE0F}]?)\s+/u;

// --- Core Logic ---

function checkAndBlockPost(postElement) {
    // Early return for invalid elements
    if (!postElement || typeof postElement.matches !== 'function') return;
    
    // Skip already processed elements
    if (postElement.classList.contains('ln-funblock-processed')) return;
    
    // Skip small elements that can't be posts (buttons, spans, etc)
    if (postElement.tagName === 'BUTTON' || postElement.tagName === 'SPAN' || postElement.tagName === 'IMG') return;
    
    // Check if element matches our selector
    if (!postElement.matches(FEED_UPDATE_SELECTOR)) {
        // Only check children if the element is large enough to potentially contain posts
        if (postElement.offsetHeight > 100) {
            const innerPosts = postElement.querySelectorAll(FEED_UPDATE_SELECTOR);
            if (innerPosts.length > 0) {
                innerPosts.forEach(checkAndBlockPost);
            }
        }
        return;
    }

    // Mark as processed before checking content
    postElement.classList.add('ln-funblock-processed');
    let blockReason = null;

    // 1. Check for long slideshows/documents
    const slideIndicators = postElement.querySelectorAll(SLIDESHOW_INDICATOR_SELECTOR);
    const documentContainer = postElement.querySelector(DOCUMENT_CONTAINER_SELECTOR);
    
    // First check for traditional slideshow indicators
    if (slideIndicators.length > 0) {
        let slideCount = 0;
        
        // Try to find slide count from indicators
        slideIndicators.forEach(indicator => {
            const text = indicator.textContent.trim();
            // Look for patterns like "23 pages" or just "23" or "• 8 pages" or "8 visuals that shift"
            const matches = text.match(/(\d+)\s*pages?/) || text.match(/^(\d+)$/) || 
                           text.match(/•\s*(\d+)\s*pages?/) || text.match(/(\d+)\s*visuals?/);
            if (matches) {
                const count = parseInt(matches[1]);
                if (count > slideCount) slideCount = count;
            }
        });

        // If no count found in indicators, try counting slides
        if (slideCount === 0) {
            const slides = postElement.querySelectorAll(SLIDESHOW_ITEM_SELECTOR);
            slideCount = slides.length;
        }

        // Also check the black header bar for slide count
        const headerText = postElement.querySelector('.feed-shared-update-v2__content')?.textContent || '';
        const headerMatch = headerText.match(/(\d+)\s*pages?/);
        if (headerMatch) {
            const count = parseInt(headerMatch[1]);
            if (count > slideCount) slideCount = count;
        }

        // Block if too many slides
        if (slideCount > MAX_SLIDES) {
            blockReason = `Long Document/Slideshow (${slideCount} slides)`;
        }
    }
    // Then check for document container with iframe
    else if (documentContainer) {
        // Set up a mutation observer to watch for changes in the document container
        const documentObserver = new MutationObserver((mutations) => {
            if (postElement.classList.contains('ln-funblock-hidden-original')) {
                documentObserver.disconnect();
                return;
            }

            // First check the iframe title for page count
            const iframe = documentContainer.querySelector('iframe');
            if (iframe) {
                const title = iframe.getAttribute('title') || '';
                const matches = title.match(/(\d+)\s*pages?/i);
                if (matches) {
                    const count = parseInt(matches[1]);
                    if (count > MAX_SLIDES && !postElement.classList.contains('ln-funblock-hidden-original')) {
                        console.log("LinkedIn Feed Fun Blocker: Document loaded with", count, "pages");
                        blockPostElement(postElement, `Long Document (${count} pages)`);
                        documentObserver.disconnect();
                        return;
                    }
                }
            }

            // Then check for indicators that might have been added
            const newIndicators = postElement.querySelectorAll(SLIDESHOW_INDICATOR_SELECTOR);
            newIndicators.forEach(indicator => {
                const text = indicator.textContent.trim();
                const matches = text.match(/(\d+)\s*pages?/) || text.match(/^(\d+)$/);
                if (matches) {
                    const count = parseInt(matches[1]);
                    if (count > MAX_SLIDES && !postElement.classList.contains('ln-funblock-hidden-original')) {
                        console.log("LinkedIn Feed Fun Blocker: Document loaded with", count, "pages");
                        blockPostElement(postElement, `Long Document (${count} pages)`);
                        documentObserver.disconnect();
                    }
                }
            });
        });

        // Start observing the document container
        documentObserver.observe(documentContainer, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['title']
        });
    }

    // 2. Check for diverse emoji bullet points (only if not already blocked)
    if (!blockReason) {
        const postTextElements = postElement.querySelectorAll(POST_TEXT_SELECTOR + ' span[dir="ltr"], ' + POST_TEXT_SELECTOR + ' p');
        let combinedText = "";
        postTextElements.forEach(span => {
            combinedText += (span.innerText || span.textContent) + "\n";
        });

        if (combinedText) {
            const lines = combinedText.split('\n');
            const startingEmojis = new Set();

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                const match = trimmedLine.match(EMOJI_REGEX);
                if (match) {
                    startingEmojis.add(match[1]);
                }
            }

            if (startingEmojis.size >= MIN_DIFFERENT_EMOJI_BULLETS) {
                blockReason = `Creative Emoji Bullets (${startingEmojis.size} types)`;
            }
        }
    }

    // 3. Block the post if a reason was found
    if (blockReason) {
        console.log("LinkedIn Feed Fun Blocker: Blocking post -", blockReason);
        blockPostElement(postElement, blockReason);
    }
}

function getPostAuthor(postElement) {
    // Try to find the author name from various possible elements
    const authorElement = postElement.querySelector('.update-components-actor__title span[dir="ltr"], .update-components-actor__name');
    if (authorElement) {
        return authorElement.textContent.trim();
    }
    return "Unknown Author";
}

function blockPostElement(originalPostElement, reason) {
    // Prevent double-blocking if somehow called again
    if (originalPostElement.classList.contains('ln-funblock-hidden-original')) return;

    // Get the author name before hiding the post
    const author = getPostAuthor(originalPostElement);

    // Hide the original post
    originalPostElement.style.display = 'none';
    originalPostElement.classList.add('ln-funblock-hidden-original'); // Mark for potential unblocking

    // Create placeholder
    const placeholder = document.createElement('div');
    placeholder.classList.add('ln-funblock-placeholder');

    const message = document.createElement('p');
    const randomEmoji = ['🚧', '🧱', '🤫', '🥱', '🙈', '⏸️'][Math.floor(Math.random() * 6)];
    // Remove the author name from the reason text since it's already in the "Post by" part
    const cleanReason = reason.replace(/^Post by [^:]+: /, '');
    message.textContent = `${randomEmoji} Post by ${author} blocked: ${cleanReason}`;

    const unblockButton = document.createElement('button');
    unblockButton.textContent = 'Show Anyway';
    unblockButton.classList.add('ln-funblock-unblock-button');

    unblockButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling if needed
        originalPostElement.style.display = ''; // Restore original display
        originalPostElement.classList.remove('ln-funblock-hidden-original');
        placeholder.remove(); // Remove the placeholder
        console.log("LinkedIn Feed Fun Blocker: Post unblocked.");
        // Mark as processed again *after* unblocking to prevent immediate re-blocking by observer
        originalPostElement.classList.add('ln-funblock-processed');
    });

    placeholder.appendChild(message);
    placeholder.appendChild(unblockButton);

    // Insert placeholder *before* the original post's position
    if (originalPostElement.parentNode) {
        originalPostElement.parentNode.insertBefore(placeholder, originalPostElement);
    } else {
        console.warn("LinkedIn Feed Fun Blocker: Could not find parent node to insert placeholder.");
    }
}

// --- Observe Feed Changes ---

const feedObserver = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                // Check if the added node itself is a post or if it contains posts
                 if (node.nodeType === Node.ELEMENT_NODE) {
                      checkAndBlockPost(node); // Check the node itself and potentially its children
                 }
            });
        }
    }
});

// Function to start observing when the feed container is ready
function startObserver() {
    // Use a selector that is likely to contain the feed posts
    // '.scaffold-finite-scroll__content' is often the scrolling container holding the posts
    const feedContainer = document.querySelector(".scaffold-finite-scroll__content");

    if (feedContainer) {
        console.log("LinkedIn Feed Fun Blocker: Observing feed container area.", feedContainer);
        feedObserver.observe(feedContainer, { childList: true, subtree: true }); // Observe the container and its descendants

        // Initial check for posts already loaded within the container
        console.log("LinkedIn Feed Fun Blocker: Running initial check.");
        feedContainer.querySelectorAll(FEED_UPDATE_SELECTOR).forEach(checkAndBlockPost);
    } else {
        console.log("LinkedIn Feed Fun Blocker: Waiting for feed container area...");
        // If not found, try again shortly. LinkedIn feed can load dynamically.
        setTimeout(startObserver, 750); // Increased wait time slightly
    }
}

// Initial call to start the observer setup
startObserver();


// Optional: Clean up observer on page unload
window.addEventListener('unload', () => {
    feedObserver.disconnect();
    console.log("LinkedIn Feed Fun Blocker: Observer disconnected.");
});