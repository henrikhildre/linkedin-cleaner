console.log("LinkedIn Cleaner: Content script loaded.");

// Inject styles immediately
const style = document.createElement('style');
style.textContent = `
.ln-funblock-placeholder {
    background: var(--color-background-container, #fff);
    border: 2px dotted var(--color-text-low-emphasis, rgba(0,0,0,0.4));
    border-radius: 8px;
    margin: 12px 0;
    padding: 20px;
    text-align: center;
    font-size: 14px;
    color: var(--color-text-low-emphasis, rgba(0,0,0,0.6));
    box-shadow: 0 0 0 1px rgba(0,0,0,0.05);
}

.ln-funblock-unblock-button {
    background: transparent;
    border: 2px dotted var(--color-button-container-secondary, rgba(0,0,0,0.4));
    border-radius: 16px;
    color: var(--color-text-low-emphasis, rgba(0,0,0,0.6));
    cursor: pointer;
    font-size: 14px;
    margin-top: 12px;
    padding: 6px 16px;
    transition: all 0.2s;
}

.ln-funblock-unblock-button:hover {
    background: var(--color-button-container-secondary-hover, rgba(0,0,0,0.08));
    color: var(--color-text, rgba(0,0,0,0.9));
    border: 2px solid var(--color-button-container-secondary, rgba(0,0,0,0.6));
}
`;
document.head.appendChild(style);

// --- Configuration ---
const MAX_SLIDES = 3; // Block posts with more slides/images than this
const MIN_DIFFERENT_EMOJI_BULLETS = 2; // Block if >= N *different* emoji bullets are found

// --- Selectors (UPDATED based on user input) ---
// Use the data attribute to identify individual posts
const FEED_UPDATE_SELECTOR = "[data-view-name='feed-full-update']";

// Selectors *within* a post (these might still need adjustment if structure changed)
const SLIDESHOW_INDICATOR_SELECTOR = ".ssplayer-topbar-details__preview, .ssplayer-topbar-details__full-screen, .ssplayer-pagination-length, .ssplayer-pagination-value, .carousel__counter, .carousel-slider__counter, .document-navigation__count, .document-navigation-indicator__count, .document-s-container__document-element";
const SLIDESHOW_ITEM_SELECTOR = ".carousel-slide, .carousel__slide, .carousel-slider__slide, .document-s-container__document-element";
const POST_TEXT_SELECTOR = ".update-components-text, .feed-shared-update-v2__description";
const DOCUMENT_CONTAINER_SELECTOR = ".document-s-container";
const EMOJI_REGEX = /^\s*([\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}][\u{FE00}-\u{FE0F}]?)\s+/u;

// Function to check for slides in a container
function checkForSlides(container, postElement) {
    // Check for carousel indicators
    const carouselCounters = container.querySelectorAll('.carousel__counter, .carousel-slider__counter, .document-navigation__count, .document-navigation-indicator__count');
    carouselCounters.forEach(counter => {
        const text = counter.textContent.trim();
        console.log("LinkedIn Cleaner: Found carousel counter:", text);
        // Match patterns like "1/11", "2 of 8", "Page 1 of 12", "Preview 5 of 12 pages"
        const matches = text.match(/(\d+)\s*\/\s*(\d+)/) || 
                      text.match(/(\d+)\s*of\s*(\d+)/) || 
                      text.match(/Page\s*(\d+)\s*of\s*(\d+)/) || 
                      text.match(/Preview\s+\d+\s+of\s+(\d+)\s*pages?/) ||
                      text.match(/•\s*(\d+)\s*pages?/);
        if (matches) {
            const total = parseInt(matches[2] || matches[1]); // Use first group if second doesn't exist
            console.log("LinkedIn Cleaner: Found total slides in carousel:", total);
            if (total > MAX_SLIDES) {
                console.log("LinkedIn Cleaner: Blocking carousel with", total, "slides");
                blockPostElement(postElement, `Long Document (${total} pages)`);
                return true;
            }
        }
    });

    // Check for document player
    const documentPlayer = container.querySelector('.document-s-container__document-element');
    if (documentPlayer) {
        console.log("LinkedIn Cleaner: Found document player");
        
        // Check document container aspect ratio
        const containerStyle = window.getComputedStyle(container);
        const paddingTop = parseFloat(containerStyle.paddingTop);
        if (paddingTop > 100) { // LinkedIn documents typically have padding-top > 100%
            console.log("LinkedIn Cleaner: Document container has typical slideshow aspect ratio");
            
            // First check the document title in the parent container
            const titleElement = container.closest('[data-view-name="feed-full-update"]')?.querySelector('.document-s-container__document-element');
            if (titleElement) {
                const title = titleElement.getAttribute('title');
                console.log("LinkedIn Cleaner: Document title:", title);
                if (title) {
                    const matches = title.match(/(\d+)\s*(pages?|slides?|visuals?)/i);
                    if (matches) {
                        const count = parseInt(matches[1]);
                        console.log("LinkedIn Cleaner: Found page count in document title:", count);
                        if (count > MAX_SLIDES) {
                            console.log("LinkedIn Cleaner: Blocking document with", count, "pages");
                            blockPostElement(postElement, `Long Document (${count} pages)`);
                            return true;
                        }
                    }
                }
            }

            // Check for page count in the black header bar
            const headerBar = container.closest('[data-view-name="feed-full-update"]')?.querySelector('.feed-shared-update-v2__content');
            if (headerBar) {
                const headerText = headerBar.textContent;
                console.log("LinkedIn Cleaner: Checking header bar text:", headerText);
                const matches = headerText.match(/(\d+)\s*(pages?|slides?|visuals?)/i);
                if (matches) {
                    const count = parseInt(matches[1]);
                    console.log("LinkedIn Cleaner: Found page count in header:", count);
                    if (count > MAX_SLIDES) {
                        console.log("LinkedIn Cleaner: Blocking document with", count, "pages");
                        blockPostElement(postElement, `Long Document (${count} pages)`);
                        return true;
                    }
                }
            }
        }

        // Check for page count in various attributes
        const attributes = ['title', 'aria-label', 'data-title'];
        for (const attr of attributes) {
            const value = documentPlayer.getAttribute(attr);
            if (value) {
                console.log("LinkedIn Cleaner: Checking document player attribute", attr + ":", value);
                // Look for patterns like "12 pages", "Document (8 pages)", etc.
                const matches = value.match(/(\d+)\s*(pages?|slides?|visuals?)/i);
                if (matches) {
                    const count = parseInt(matches[1]);
                    console.log("LinkedIn Cleaner: Found page count in document player:", count);
                    if (count > MAX_SLIDES) {
                        console.log("LinkedIn Cleaner: Blocking document with", count, "pages");
                        blockPostElement(postElement, `Long Document (${count} pages)`);
                        return true;
                    }
                }
            }
        }

        // If we have an iframe, try to check its title
        const iframe = documentPlayer;
        if (iframe.tagName === 'IFRAME') {
            const iframeTitle = iframe.getAttribute('title');
            console.log("LinkedIn Cleaner: Checking iframe title:", iframeTitle);
            if (iframeTitle) {
                const matches = iframeTitle.match(/(\d+)\s*(pages?|slides?|visuals?)/i);
                if (matches) {
                    const count = parseInt(matches[1]);
                    console.log("LinkedIn Cleaner: Found page count in iframe title:", count);
                    if (count > MAX_SLIDES) {
                        console.log("LinkedIn Cleaner: Blocking document with", count, "pages");
                        blockPostElement(postElement, `Long Document (${count} pages)`);
                        return true;
                    }
                }
            }
        }
    }

    // Count actual slides as last resort
    const slides = container.querySelectorAll(SLIDESHOW_ITEM_SELECTOR);
    if (slides.length > MAX_SLIDES) {
        console.log("LinkedIn Cleaner: Found", slides.length, "slides by counting elements");
        blockPostElement(postElement, `Long Document (${slides.length} pages)`);
        return true;
    }

    return false;
}

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
    
    console.log("LinkedIn Cleaner: Checking post for slideshows", {
        hasSlideIndicators: slideIndicators.length > 0,
        hasDocumentContainer: !!documentContainer,
        isPromoted: postElement.textContent.includes("Promoted")
    });
    
    // First check for traditional slideshow indicators
    if (slideIndicators.length > 0) {
        let slideCount = 0;
        
        // Try to find slide count from indicators
        slideIndicators.forEach(indicator => {
            const text = indicator.textContent.trim();
            console.log("LinkedIn Cleaner: Checking indicator text:", text);
            // Look for patterns like "23 pages" or just "23" or "• 8 pages" or "8 visuals that shift"
            const matches = text.match(/(\d+)\s*pages?/) || text.match(/^(\d+)$/) || 
                           text.match(/•\s*(\d+)\s*pages?/) || text.match(/(\d+)\s*visuals?/);
            if (matches) {
                const count = parseInt(matches[1]);
                console.log("LinkedIn Cleaner: Found slide count in indicator:", count);
                if (count > slideCount) slideCount = count;
            }
        });

        // If no count found in indicators, try counting slides
        if (slideCount === 0) {
            const slides = postElement.querySelectorAll(SLIDESHOW_ITEM_SELECTOR);
            slideCount = slides.length;
            console.log("LinkedIn Cleaner: Counted slides directly:", slideCount);
        }

        // Also check the black header bar for slide count
        const headerText = postElement.querySelector('.feed-shared-update-v2__content')?.textContent || '';
        console.log("LinkedIn Cleaner: Checking header text:", headerText);
        // Look for patterns like "• 7 pages", "7 pages", "Preview 5 of 12 pages", "90-dagersplan for nye ledere • 17 pages"
        const headerMatch = headerText.match(/(\d+)\s*pages?/) || 
                          headerText.match(/•\s*(\d+)\s*pages?/) || 
                          headerText.match(/Preview\s+\d+\s+of\s+(\d+)\s*pages?/) ||
                          headerText.match(/(\d+)\s*visuals?/) || 
                          headerText.match(/(\d+)\s*slides?/) ||
                          headerText.match(/.*?•\s*(\d+)\s*pages?/);
        if (headerMatch) {
            const count = parseInt(headerMatch[1]);
            console.log("LinkedIn Cleaner: Found page count in header:", count, "from text:", headerText);
            if (count > MAX_SLIDES) {
                console.log("LinkedIn Cleaner: Blocking document with", count, "pages");
                blockReason = `Long Document (${count} pages)`;
                blockPostElement(postElement, blockReason);
                return;
            }
        } else {
            console.log("LinkedIn Cleaner: No page count found in header text:", headerText);
        }
    }
    // Then check for document container with iframe
    else if (documentContainer) {
        console.log("LinkedIn Cleaner: Found document container, setting up observer");
        
        // First check the header bar for page count (some posts show this before the document loads)
        const headerText = postElement.querySelector('.feed-shared-update-v2__content')?.textContent || '';
        console.log("LinkedIn Cleaner: Checking header text for early detection:", headerText);
        // Look for patterns like "• 7 pages", "7 pages", "Preview 5 of 12 pages"
        const headerMatch = headerText.match(/(\d+)\s*pages?/) || 
                          headerText.match(/•\s*(\d+)\s*pages?/) || 
                          headerText.match(/Preview\s+\d+\s+of\s+(\d+)\s*pages?/) ||
                          headerText.match(/(\d+)\s*visuals?/) || 
                          headerText.match(/(\d+)\s*slides?/);
        if (headerMatch) {
            const count = parseInt(headerMatch[1]);
            console.log("LinkedIn Cleaner: Found page count in header:", count);
            if (count > MAX_SLIDES) {
                console.log("LinkedIn Cleaner: Blocking document with", count, "pages");
                blockReason = `Long Document (${count} pages)`;
                blockPostElement(postElement, blockReason);
                return;
            }
        }

        // If document is still loading, set up a more specific mutation observer
        if (headerText.includes("Your document is loading")) {
            console.log("LinkedIn Cleaner: Document is loading, setting up loading observer");
            const loadingObserver = new MutationObserver((mutations) => {
                const updatedHeaderText = postElement.querySelector('.feed-shared-update-v2__content')?.textContent || '';
                console.log("LinkedIn Cleaner: Checking updated header text:", updatedHeaderText);
                
                // Check for page count after loading
                const loadedMatch = updatedHeaderText.match(/(\d+)\s*pages?/) || 
                                  updatedHeaderText.match(/•\s*(\d+)\s*pages?/) ||
                                  updatedHeaderText.match(/Preview\s+\d+\s+of\s+(\d+)\s*pages?/) ||
                                  updatedHeaderText.match(/(\d+)\s*visuals?/) || 
                                  updatedHeaderText.match(/(\d+)\s*slides?/);
                
                if (loadedMatch) {
                    const count = parseInt(loadedMatch[1]);
                    console.log("LinkedIn Cleaner: Found page count after loading:", count);
                    if (count > MAX_SLIDES) {
                        console.log("LinkedIn Cleaner: Blocking document with", count, "pages");
                        blockPostElement(postElement, `Long Document (${count} pages)`);
                        loadingObserver.disconnect();
                        return;
                    }
                }
                
                // If no longer loading, disconnect observer
                if (!updatedHeaderText.includes("Your document is loading")) {
                    console.log("LinkedIn Cleaner: Document finished loading");
                    loadingObserver.disconnect();
                }
            });
            
            loadingObserver.observe(postElement, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        // Initial check
        if (checkForSlides(documentContainer, postElement)) {
            return;
        }

        // Set up a mutation observer to watch for changes in the document container
        const documentObserver = new MutationObserver((mutations) => {
            if (postElement.classList.contains('ln-funblock-hidden-original')) {
                console.log("LinkedIn Cleaner: Post already blocked, disconnecting observer");
                documentObserver.disconnect();
                return;
            }

            // Check if any new content has been added that indicates slides
            if (checkForSlides(documentContainer, postElement)) {
                documentObserver.disconnect();
                return;
            }

            // Also check the iframe content if available
            const iframe = documentContainer.querySelector('iframe');
            if (iframe) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (iframeDoc) {
                        console.log("LinkedIn Cleaner: Checking iframe content");
                        if (checkForSlides(iframeDoc, postElement)) {
                            documentObserver.disconnect();
                            return;
                        }
                    }
                } catch (e) {
                    // Cross-origin restrictions might prevent access
                    console.log("LinkedIn Cleaner: Could not access iframe content");
                }
            }
        });

        // Start observing the document container with all possible changes
        documentObserver.observe(documentContainer, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['title', 'aria-label', 'data-title', 'style']
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
                blockReason = `Too many emoji bulletpoints (${startingEmojis.size} types)`;
            }
        }
    }

    // 3. Block the post if a reason was found
    if (blockReason) {
        console.log("LinkedIn Cleaner: Blocking post -", blockReason);
        blockPostElement(postElement, blockReason);
    } else {
        // Set up intersection observer for document containers that might load later
        const documentContainer = postElement.querySelector(DOCUMENT_CONTAINER_SELECTOR);
        if (documentContainer) {
            console.log("LinkedIn Cleaner: Setting up intersection observer for document container");
            let documentObserver;
            const intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        console.log("LinkedIn Cleaner: Document container is now visible");
                        // Re-check the document container now that it's visible
                        const headerText = postElement.querySelector('.feed-shared-update-v2__content')?.textContent || '';
                        console.log("LinkedIn Cleaner: Checking header text on visibility:", headerText);
                        const headerMatch = headerText.match(/(\d+)\s*pages?/) || headerText.match(/•\s*(\d+)\s*pages?/) || 
                                         headerText.match(/(\d+)\s*visuals?/) || headerText.match(/(\d+)\s*slides?/);
                        if (headerMatch) {
                            const count = parseInt(headerMatch[1]);
                            console.log("LinkedIn Cleaner: Found page count in header on visibility:", count);
                            if (count > MAX_SLIDES) {
                                console.log("LinkedIn Cleaner: Blocking document with", count, "pages");
                                blockPostElement(postElement, `Long Document (${count} pages)`);
                                intersectionObserver.disconnect();
                                if (documentObserver) {
                                    documentObserver.disconnect();
                                }
                                return;
                            }
                        }
                        
                        // Set up mutation observer now that the container is visible
                        documentObserver = new MutationObserver((mutations) => {
                            if (postElement.classList.contains('ln-funblock-hidden-original')) {
                                console.log("LinkedIn Cleaner: Post already blocked, disconnecting observer");
                                documentObserver.disconnect();
                                intersectionObserver.disconnect();
                                return;
                            }

                            // Check if any new content has been added that indicates slides
                            if (checkForSlides(documentContainer, postElement)) {
                                documentObserver.disconnect();
                                intersectionObserver.disconnect();
                                return;
                            }
                        });

                        documentObserver.observe(documentContainer, {
                            childList: true,
                            subtree: true,
                            characterData: true,
                            attributes: true,
                            attributeFilter: ['title', 'aria-label', 'data-title', 'style']
                        });
                    }
                });
            }, {
                threshold: 0.1 // Start observing when at least 10% of the element is visible
            });

            intersectionObserver.observe(documentContainer);
        }
    }
}

function getPostAuthor(postElement) {
    // First try the most specific selector for the main author name
    const mainAuthorElement = postElement.querySelector('.update-components-actor__title span[dir="ltr"] > span[aria-hidden="true"]');
    if (mainAuthorElement) {
        return mainAuthorElement.textContent.trim();
    }

    // Fallback to other possible selectors if the main one isn't found
    const fallbackElements = [
        '.update-components-actor__title span[dir="ltr"]:first-child',
        '.update-components-actor__name',
        '.update-components-text__title'
    ];

    for (const selector of fallbackElements) {
        const element = postElement.querySelector(selector);
        if (element) {
            // Clean up the text: remove duplicates and normalize spaces
            const text = element.textContent.trim();
            // Split by common separators and take the first part
            const parts = text.split(/[•\-,]/)[0].trim();
            // Remove any duplicate names (e.g., "John Smith John Smith" -> "John Smith")
            const words = parts.split(/\s+/);
            const uniqueWords = [];
            for (let i = 0; i < words.length; i++) {
                const remaining = words.slice(i).join(' ');
                if (!uniqueWords.join(' ').includes(remaining)) {
                    uniqueWords.push(words[i]);
                }
            }
            return uniqueWords.join(' ');
        }
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
    originalPostElement.classList.add('ln-funblock-hidden-original');

    // Create placeholder
    const placeholder = document.createElement('div');
    placeholder.classList.add('ln-funblock-placeholder');

    const message = document.createElement('p');
    const randomEmoji = ['🚧', '🧱', '🤫', '🥱', '🙈', '⏸️'][Math.floor(Math.random() * 6)];
    
    // Ensure the reason doesn't already contain the author name
    let cleanReason = reason;
    const authorPattern = new RegExp(`Post by ${author}[:\\s]+`, 'i');
    cleanReason = cleanReason.replace(authorPattern, '');
    cleanReason = cleanReason.replace(/^Post by [^:]+:\s*/, '');
    
    message.textContent = `${randomEmoji} Post by ${author} blocked: ${cleanReason}`;

    const unblockButton = document.createElement('button');
    unblockButton.textContent = 'Show Anyway';
    unblockButton.classList.add('ln-funblock-unblock-button');

    unblockButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling if needed
        originalPostElement.style.display = ''; // Restore original display
        originalPostElement.classList.remove('ln-funblock-hidden-original');
        placeholder.remove(); // Remove the placeholder
        console.log("LinkedIn Cleaner: Post unblocked.");
        // Mark as processed again *after* unblocking to prevent immediate re-blocking by observer
        originalPostElement.classList.add('ln-funblock-processed');
    });

    placeholder.appendChild(message);
    placeholder.appendChild(unblockButton);

    // Insert placeholder *before* the original post's position
    if (originalPostElement.parentNode) {
        originalPostElement.parentNode.insertBefore(placeholder, originalPostElement);
    } else {
        console.warn("LinkedIn Cleaner: Could not find parent node to insert placeholder.");
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
        console.log("LinkedIn Cleaner: Observing feed container area.", feedContainer);
        feedObserver.observe(feedContainer, { childList: true, subtree: true }); // Observe the container and its descendants

        // Initial check for posts already loaded within the container
        console.log("LinkedIn Cleaner: Running initial check.");
        feedContainer.querySelectorAll(FEED_UPDATE_SELECTOR).forEach(checkAndBlockPost);
    } else {
        console.log("LinkedIn Cleaner: Waiting for feed container area...");
        // If not found, try again shortly. LinkedIn feed can load dynamically.
        setTimeout(startObserver, 750); // Increased wait time slightly
    }
}

// Initial call to start the observer setup
startObserver();


// Optional: Clean up observer on page unload
window.addEventListener('unload', () => {
    feedObserver.disconnect();
    console.log("LinkedIn Cleaner: Observer disconnected.");
});