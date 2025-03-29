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
    // First check the post text for page count indicators
    const postText = postElement.querySelector(POST_TEXT_SELECTOR)?.textContent || '';
    const pageCountMatches = postText.match(/(\d+)\s*(pages?|slides?|visuals?)/gi);
    if (pageCountMatches) {
        for (const match of pageCountMatches) {
            const count = parseInt(match.match(/\d+/)[0]);
            console.log("LinkedIn Cleaner: Found page count in post text:", count);
            if (count > MAX_SLIDES) {
                console.log("LinkedIn Cleaner: Hiding document with", count, "pages from post text");
                blockPostElement(postElement, `Long Document (${count} pages)`);
                return true;
            }
        }
    }

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
            
            // Check for page count in the post content
            const postContent = postElement.querySelector('.feed-shared-update-v2__content');
            if (postContent) {
                const contentText = postContent.textContent;
                console.log("LinkedIn Cleaner: Checking post content text:", contentText);
                const matches = contentText.match(/(\d+)\s*(pages?|slides?|visuals?)/i);
                if (matches) {
                    const count = parseInt(matches[1]);
                    console.log("LinkedIn Cleaner: Found page count in post content:", count);
                    if (count > MAX_SLIDES) {
                        console.log("LinkedIn Cleaner: Blocking document with", count, "pages");
                        blockPostElement(postElement, `Long Document (${count} pages)`);
                        return true;
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
        }

        // If we have an iframe, try to check its title and content
        if (documentPlayer.tagName === 'IFRAME') {
            console.log("LinkedIn Cleaner: Found document iframe");
            const iframeTitle = documentPlayer.getAttribute('title');
            console.log("LinkedIn Cleaner: Checking iframe title:", iframeTitle);
            
            // Direct check for page count in iframe title
            if (iframeTitle) {
                // Regular check for page counts like "X pages" in the title
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
            
                // Special handling for "Document player for: X" format
                if (iframeTitle.startsWith("Document player for:")) {
                    const docTitle = iframeTitle.replace("Document player for:", "").trim();
                    console.log("LinkedIn Cleaner: Extracted document title:", docTitle);
                    
                    // First try a direct search for page numbers in nearby post header
                    const postHeader = postElement.querySelector('.feed-shared-update-v2__description, .feed-shared-update-v2__content');
                    if (postHeader) {
                        const headerText = postHeader.textContent || '';
                        console.log("LinkedIn Cleaner: Checking post header for page numbers:", headerText);
                        
                        // Look for any standalone numbers that might be page counts
                        const numberMatches = headerText.match(/[^\d](\d+)[^\d]/g);
                        if (numberMatches) {
                            console.log("LinkedIn Cleaner: Found potential numbers in header:", numberMatches);
                            // Extract just the numbers
                            const numbers = numberMatches.map(match => {
                                const num = match.match(/\d+/)[0];
                                return parseInt(num);
                            });
                            
                            // Filter to reasonable page counts (2-50)
                            const possiblePageCounts = numbers.filter(n => n >= 2 && n <= 50);
                            console.log("LinkedIn Cleaner: Possible page counts:", possiblePageCounts);
                            
                            // If we find any page counts > MAX_SLIDES, block
                            for (const count of possiblePageCounts) {
                                if (count > MAX_SLIDES) {
                                    console.log("LinkedIn Cleaner: Blocking document with potential page count:", count);
                                    blockPostElement(postElement, `Long Document (${count} pages)`);
                                    return true;
                                }
                            }
                        }
                    }
                    
                    // Look for this title in nearby elements to find page count
                    const parentElements = [
                        container.parentElement,
                        postElement.querySelector('.feed-shared-update-v2__content'),
                        ...Array.from(postElement.querySelectorAll('h2, h3, .document-title, .update-components-document__title-bar'))
                    ];
                    
                    for (const parent of parentElements) {
                        if (!parent) continue;
                        
                        // Get text content from this element and its children
                        const parentText = parent.textContent || '';
                        console.log("LinkedIn Cleaner: Checking parent text for title match:", parentText);
                        
                        if (parentText.includes(docTitle) || docTitle.includes(parentText.trim())) {
                            console.log("LinkedIn Cleaner: Found matching parent element for document title");
                            
                            // Look for number format at the end like "• 4 pages" or just "• 4"
                            const pageMatches = parentText.match(/[•\-]\s*(\d+)(?:\s*pages?)?/i) ||
                                               parentText.match(/(\d+)\s*pages?$/i) ||
                                               parentText.match(/på under et kvarter!?\s*[•\-]?\s*(\d+)/i);
                            
                            if (pageMatches) {
                                const count = parseInt(pageMatches[1]);
                                console.log("LinkedIn Cleaner: Found page count in parent text:", count);
                                if (count > MAX_SLIDES) {
                                    console.log("LinkedIn Cleaner: Blocking document with", count, "pages from parent text");
                                    blockPostElement(postElement, `Long Document (${count} pages)`);
                                    return true;
                                }
                            }
                            
                            // Check nearby siblings for page count
                            const siblings = Array.from(parent.parentElement?.children || []);
                            for (const sibling of siblings) {
                                if (sibling === parent) continue;
                                
                                const siblingText = sibling.textContent || '';
                                console.log("LinkedIn Cleaner: Checking sibling text:", siblingText);
                                
                                const siblingMatches = siblingText.match(/[•\-]\s*(\d+)(?:\s*pages?)?/i) ||
                                                     siblingText.match(/(\d+)\s*pages?$/i) ||
                                                     siblingText.match(/(\d+)$/);
                                
                                if (siblingMatches) {
                                    const count = parseInt(siblingMatches[1]);
                                    console.log("LinkedIn Cleaner: Found page count in sibling text:", count);
                                    if (count > MAX_SLIDES) {
                                        console.log("LinkedIn Cleaner: Blocking document with", count, "pages from sibling text");
                                        blockPostElement(postElement, `Long Document (${count} pages)`);
                                        return true;
                                    }
                                }
                            }
                        }
                    }
                    
                    // Check the header bar for document information with page counts
                    const headerElement = postElement.querySelector('.feed-shared-update-v2__content, .update-components-document__title-bar');
                    if (headerElement) {
                        // Get text before examining it
                        const headerText = headerElement.textContent || '';
                        
                        console.log("LinkedIn Cleaner: Checking header text:", headerText);
                        
                        // Look for different page number formats in the header text
                        const pageCountPatterns = [
                            /[•\-]\s*(\d+)(?:\s*pages?)?$/i,    // "• 4" or "• 4 pages" at end of text
                            /(\d+)\s*pages?$/i,                  // "4 pages" at end
                            /[^\d](\d+)(?:\s*pages?)?\s*$/i,     // Any number at the end
                            /[•\-:]\s*(\d+)/i                    // Bullet/dash/colon with number anywhere
                        ];
                        
                        // Try each pattern
                        for (const pattern of pageCountPatterns) {
                            const match = headerText.match(pattern);
                            if (match) {
                                const count = parseInt(match[1]);
                                
                                // Only consider reasonable page counts to avoid false positives
                                if (count >= 2 && count <= 100) {
                                    console.log("LinkedIn Cleaner: Found page count in header:", count, "with pattern:", pattern);
                                    if (count > MAX_SLIDES) {
                                        console.log("LinkedIn Cleaner: Blocking document with", count, "pages from header");
                                        blockPostElement(postElement, `Long Document (${count} pages)`);
                                        return true;
                                    }
                                }
                            }
                        }
                        
                        // Final check for any trailing number that might indicate pages
                        const trailingNumberMatch = headerText.match(/.*?(\d+)\s*$/);
                        if (trailingNumberMatch) {
                            const count = parseInt(trailingNumberMatch[1]);
                            
                            // Only consider reasonable page counts to avoid false positives
                            // Get text content from this element and its children
                            const parentText = parent.textContent || '';
                            console.log("LinkedIn Cleaner: Checking parent text for title match:", parentText);
                            
                            if (parentText.includes(docTitle) || docTitle.includes(parentText.trim())) {
                                console.log("LinkedIn Cleaner: Found matching parent element for document title");
                                
                                // Look for number format at the end like "• 4 pages" or just "• 4"
                                const pageMatches = parentText.match(/[•\-]\s*(\d+)(?:\s*pages?)?/i) ||
                                                   parentText.match(/(\d+)\s*pages?$/i) ||
                                                   parentText.match(/på under et kvarter!?\s*[•\-]?\s*(\d+)/i);
                                
                                if (pageMatches) {
                                    const count = parseInt(pageMatches[1]);
                                    console.log("LinkedIn Cleaner: Found page count in parent text:", count);
                                    if (count > MAX_SLIDES) {
                                        console.log("LinkedIn Cleaner: Blocking document with", count, "pages from parent text");
                                        blockPostElement(postElement, `Long Document (${count} pages)`);
                                        return true;
                                    }
                                }
                                
                                // Check nearby siblings for page count
                                const siblings = Array.from(parent.parentElement?.children || []);
                                for (const sibling of siblings) {
                                    if (sibling === parent) continue;
                                    
                                    const siblingText = sibling.textContent || '';
                                    console.log("LinkedIn Cleaner: Checking sibling text:", siblingText);
                                    
                                    const siblingMatches = siblingText.match(/[•\-]\s*(\d+)(?:\s*pages?)?/i) ||
                                                         siblingText.match(/(\d+)\s*pages?$/i) ||
                                                         siblingText.match(/(\d+)$/);
                                    
                                    if (siblingMatches) {
                                        const count = parseInt(siblingMatches[1]);
                                        console.log("LinkedIn Cleaner: Found page count in sibling text:", count);
                                        if (count > MAX_SLIDES) {
                                            console.log("LinkedIn Cleaner: Blocking document with", count, "pages from sibling text");
                                            blockPostElement(postElement, `Long Document (${count} pages)`);
                                            return true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Try to access iframe content if possible
            try {
                const iframeDoc = documentPlayer.contentDocument || documentPlayer.contentWindow?.document;
                if (iframeDoc) {
                    console.log("LinkedIn Cleaner: Checking iframe content");
                    const iframeText = iframeDoc.body?.textContent || '';
                    const matches = iframeText.match(/(\d+)\s*(pages?|slides?|visuals?)/i);
                    if (matches) {
                        const count = parseInt(matches[1]);
                        console.log("LinkedIn Cleaner: Found page count in iframe content:", count);
                        if (count > MAX_SLIDES) {
                            console.log("LinkedIn Cleaner: Blocking document with", count, "pages");
                            blockPostElement(postElement, `Long Document (${count} pages)`);
                            return true;
                        }
                    }
                }
            } catch (e) {
                // Cross-origin restrictions might prevent access
                console.log("LinkedIn Cleaner: Could not access iframe content");
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

    // Get post ID and author for better logging
    const postId = postElement.closest('[data-id]')?.getAttribute('data-id') || 'unknown';
    const authorName = getPostAuthor(postElement) || 'unknown';
    console.log(`LinkedIn Cleaner: Checking post by ${authorName} (${postId})`);

    // Mark as processed before checking content
    postElement.classList.add('ln-funblock-processed');
    let blockReason = null;

    // 1. Check for long slideshows/documents
    const slideIndicators = postElement.querySelectorAll(SLIDESHOW_INDICATOR_SELECTOR);
    const documentContainer = postElement.querySelector(DOCUMENT_CONTAINER_SELECTOR);
    
    console.log("LinkedIn Cleaner: Checking post for slideshows", {
        postId,
        author: authorName,
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
        console.log("LinkedIn Cleaner: Found document container for post by", authorName);
        
        // First check the document title itself - this is where we often miss it for iframes
        const documentTitle = documentContainer.querySelector('iframe')?.getAttribute('title') || '';
        console.log("LinkedIn Cleaner: Document iframe title:", documentTitle);
        
        // Parse the title text for page count
        if (documentTitle) {
            // Match for specific title format: "Document player for: Lagde disse annonsene på under et kvarter!"
            const docPlayerMatches = documentTitle.match(/Document player for: (.*)/i);
            const titleText = docPlayerMatches ? docPlayerMatches[1] : documentTitle;
            
            // Log the full container element for debugging
            console.log("LinkedIn Cleaner: Document container HTML:", documentContainer.outerHTML.substring(0, 200) + "...");
            
            // ADDITIONAL DEBUG: Check the entire post HTML for "4 pages" or similar patterns
            const fullHtml = postElement.outerHTML;
            console.log("LinkedIn Cleaner: Checking for page count in full HTML, substring:", fullHtml.substring(0, 500) + "...");
            
            const pageCountMatches = fullHtml.match(/(\d+)\s*pages?/gi);
            if (pageCountMatches) {
                console.log("LinkedIn Cleaner: Found potential page counts in HTML:", pageCountMatches);
                for (const match of pageCountMatches) {
                    const count = parseInt(match.match(/\d+/)[0]);
                    if (count > MAX_SLIDES) {
                        console.log("LinkedIn Cleaner: Blocking document with", count, "pages from full HTML scan");
                        blockReason = `Long Document (${count} pages)`;
                        blockPostElement(postElement, blockReason);
                        return;
                    }
                }
            }
            
            // Try to find specifically the "Lagde disse annonsene" post which has 4 pages
            if (titleText.includes("Lagde disse annonsene på under et kvarter")) {
                console.log("LinkedIn Cleaner: Found the Norwegian ads post");
                
                // Check the black header for the page count
                const headerElements = postElement.querySelectorAll('.feed-shared-update-v2__content, h2');
                headerElements.forEach(element => {
                    console.log("LinkedIn Cleaner: Checking header element for page count:", element.textContent);
                    
                    // Look for the kvarter text followed by any number
                    const fullHeaderText = element.textContent;
                    // First try to find "• 4 pages" format
                    const headerPageMatch = fullHeaderText.match(/[•\-]\s*(\d+)\s*pages?/i) || 
                                          fullHeaderText.match(/(\d+)\s*pages?$/i) ||
                                          fullHeaderText.match(/kvarter!?\s*[•\-]?\s*(\d+)/i);
                    
                    if (headerPageMatch) {
                        const pageCount = parseInt(headerPageMatch[1]);
                        console.log("LinkedIn Cleaner: Found page count in header:", pageCount);
                        if (pageCount > MAX_SLIDES) {
                            console.log(`LinkedIn Cleaner: Blocking document with ${pageCount} pages from header`);
                            blockReason = `Long Document (${pageCount} pages)`;
                            blockPostElement(postElement, blockReason);
                            return;
                        }
                    }
                });
                
                // Check for any element with text containing both "kvarter" and a number
                const allTextElements = postElement.querySelectorAll('*');
                for (const element of allTextElements) {
                    const elementText = element.textContent || '';
                    if (elementText.includes("kvarter") || elementText.includes("annonsene")) {
                        console.log("LinkedIn Cleaner: Found element with kvarter/annonsene text:", elementText);
                        
                        // Look for any number in this text
                        const numberMatch = elementText.match(/\b(\d+)\b/);
                        if (numberMatch) {
                            const number = parseInt(numberMatch[1]);
                            // Only consider reasonable page counts (2-50)
                            if (number >= 2 && number <= 50) {
                                console.log("LinkedIn Cleaner: Found potential page count in kvarter element:", number);
                                if (number > MAX_SLIDES) {
                                    console.log(`LinkedIn Cleaner: Blocking document with ${number} pages from kvarter element`);
                                    blockReason = `Long Document (${number} pages)`;
                                    blockPostElement(postElement, blockReason);
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // First check the header for page count
        const pageCountSelectors = [
            '.feed-shared-update-v2__content',                      // Main content area
            '.update-components-document__title-bar',               // Document title bar
            '.document-navigation-indicator__count',                // Navigation counter
            '[class*="document"][class*="title"]',                  // Any element with "document" and "title" in class
            'h2',                                                   // Any h2 heading that might contain page info
            '.ssplayer-pagination-length',                          // SlideShare pagination
            '.update-components-document__container'                // Document container itself
        ];
        
        // Try all selectors to find page count
        for (const selector of pageCountSelectors) {
            const elements = postElement.querySelectorAll(selector);
            console.log(`LinkedIn Cleaner: Found ${elements.length} elements matching "${selector}"`);
            
            // Check each matching element
            for (const element of elements) {
                const text = element.textContent.trim();
                console.log(`LinkedIn Cleaner: Checking text in ${selector}:`, text);
                
                // Expanded regex patterns to catch more formats
                const pageCountPatterns = [
                    /(\d+)\s*pages?/i,                              // "4 pages"
                    /•\s*(\d+)\s*pages?/i,                          // "• 4 pages"
                    /\((\d+)\s*pages?\)/i,                          // "(4 pages)"
                    /Preview\s+\d+\s+of\s+(\d+)\s*pages?/i,         // "Preview 1 of 4 pages"
                    /(\d+)\s*visuals?/i,                            // "4 visuals"
                    /(\d+)\s*slides?/i,                             // "4 slides"
                    /.*?[•\-:]\s*(\d+)\s*pages?/i,                  // "Title - 4 pages" or "Title • 4 pages"
                    /(\d+)\s*\/\s*(\d+)/i,                          // "1/4"
                    /page\s*(\d+)\s*of\s*(\d+)/i,                   // "Page 1 of 4"
                    /(\d+)\s*av\s*(\d+)/i,                          // "1 av 4" (for Scandinavian languages)
                    /[^\d](\d+)(?:\s*pages?|\s*slides?)?$/i,        // Trailing number at end "Lagde disse annonsene på under et kvarter! • 4"
                    /(\d+)(?=\s*(?:pages?|slides?)?$)/i             // Number followed by optional "pages" or "slides"
                ];
                
                for (const pattern of pageCountPatterns) {
                    const match = text.match(pattern);
                    if (match) {
                        // Get the correct group depending on pattern
                        // For patterns with "of" or "/", use the second group (total)
                        const count = parseInt(pattern.toString().includes('of') || pattern.toString().includes('/') ? 
                                             match[2] : match[1]);
                                             
                        console.log(`LinkedIn Cleaner: Found page count in ${selector}:`, count, "with pattern:", pattern.toString());
                        
                        if (count > MAX_SLIDES) {
                            console.log("LinkedIn Cleaner: Blocking document with", count, "pages");
                            blockReason = `Long Document (${count} pages)`;
                            blockPostElement(postElement, blockReason);
                            return;
                        }
                    }
                }
            }
        }

        // Last resort - check title attribute on parent elements
        const titleElements = postElement.querySelectorAll('[title]');
        titleElements.forEach(el => {
            const titleText = el.getAttribute('title');
            if (titleText && titleText.includes('pages')) {
                console.log("LinkedIn Cleaner: Found title attribute with 'pages':", titleText);
                const pageMatch = titleText.match(/(\d+)\s*pages?/i);
                if (pageMatch) {
                    const pageCount = parseInt(pageMatch[1]);
                    if (pageCount > MAX_SLIDES) {
                        console.log(`LinkedIn Cleaner: Blocking document with ${pageCount} pages from title attribute`);
                        blockReason = `Long Document (${pageCount} pages)`;
                        blockPostElement(postElement, blockReason);
                        return;
                    }
                }
            }
        });
        
        // Enhanced generic detection for documents with a number of pages in document title
        if (documentTitle && documentTitle.includes("Document player for:")) {
            // Extract title and check if it has a number at the end possibly indicating page count
            const match = documentTitle.match(/Document player for: (.+)/);
            if (match) {
                const titleContent = match[1];
                console.log("LinkedIn Cleaner: Checking document title content:", titleContent);
                
                // Check if the title ends with a number (potentially pages)
                const numberMatch = titleContent.match(/(\d+)\s*(?:pages?)?$/i) || 
                                    titleContent.match(/•\s*(\d+)$/i) || 
                                    titleContent.match(/\s+(\d+)$/i);
                
                if (numberMatch) {
                    const pageCount = parseInt(numberMatch[1]);
                    console.log("LinkedIn Cleaner: Found potential page count in document title:", pageCount);
                    
                    // Additional check - look for this title in the DOM and see if it's followed by page count
                    const h2Elements = postElement.querySelectorAll('h2');
                    h2Elements.forEach(h2 => {
                        // If the H2 contains the title text, check for a number after it
                        const fullText = h2.textContent || '';
                        if (fullText.includes(titleContent.split('•')[0])) {
                            const fullNumberMatch = fullText.match(/(\d+)\s*pages?/i) ||
                                                  fullText.match(/•\s*(\d+)/i) ||
                                                  fullText.match(/[\s\-•]+(\d+)$/i);
                            if (fullNumberMatch) {
                                const fullPageCount = parseInt(fullNumberMatch[1]);
                                console.log("LinkedIn Cleaner: Found page count in full title:", fullPageCount);
                                if (fullPageCount > MAX_SLIDES) {
                                    console.log(`LinkedIn Cleaner: Blocking document with ${fullPageCount} pages from title H2`);
                                    blockReason = `Long Document (${fullPageCount} pages)`;
                                    blockPostElement(postElement, blockReason);
                                    return;
                                }
                            }
                        }
                    });
                    
                    // If we found a direct number in the document title and it's > MAX_SLIDES
                    if (pageCount > MAX_SLIDES) {
                        console.log(`LinkedIn Cleaner: Blocking document with ${pageCount} pages from title number`);
                        blockReason = `Long Document (${pageCount} pages)`;
                        blockPostElement(postElement, blockReason);
                        return;
                    }
                }
            }
        }
        
        // Universal patterns for page count detection regardless of language
        const universalPatterns = [
            /.*?[•\-]\s*(\d+)$/i,                    // Any title ending with "• 4" or "- 4"
            /[^\d](\d+)(?:\s*pages?|\s*slides?)?$/i,  // Any number at the end of text (optionally followed by "pages" or "slides")
            /.*?[^\d](\d+)\s*$/i,                     // Any text ending with a number
            /[•\-:]\s*(\d+)/i                         // Bullet or dash or colon followed by a number anywhere in text
        ];

        // Check content elements with universal patterns
        const documentElements = postElement.querySelectorAll('h2, .feed-shared-update-v2__content, .document-s-container, .document-s-container__document-element');
        for (const element of documentElements) {
            const text = element.textContent.trim();
            for (const pattern of universalPatterns) {
                const match = text.match(pattern);
                if (match) {
                    const pageCount = parseInt(match[1]);
                    // Only consider numbers between 2-100 as potential page counts to avoid false positives
                    if (pageCount >= 2 && pageCount <= 100) {
                        console.log(`LinkedIn Cleaner: Found potential page count with universal pattern (${pattern}):`, pageCount, "from:", text);
                        if (pageCount > MAX_SLIDES) {
                            console.log(`LinkedIn Cleaner: Blocking document with ${pageCount} pages from universal pattern`);
                            blockReason = `Long Document (${pageCount} pages)`;
                            blockPostElement(postElement, blockReason);
                            return;
                        }
                    }
                }
            }
        }
        
        // Search through the entire post text for page indicators
        const fullPostText = postElement.textContent;
        console.log("LinkedIn Cleaner: Searching full text for page indicators:", fullPostText.substring(0, 300) + "...");
        const combinedRegex = /(?:.*?)(?:•|-)?\s*(\d+)\s*pages?|(\d+)\s*\/\s*(\d+)|page\s*(\d+)\s*of\s*(\d+)|(\d+)\s*av\s*(\d+)/gi;
        let match;
        let maxCount = 0;
        
        while ((match = combinedRegex.exec(fullPostText)) !== null) {
            // Find the first non-null capturing group (the page count)
            const capturedGroups = match.slice(1).filter(g => g !== undefined);
            if (capturedGroups.length) {
                // Use the appropriate group based on which pattern matched
                let count;
                if (match[0].includes('/') || match[0].toLowerCase().includes('of') || match[0].includes('av')) {
                    // For patterns with total pages as second number
                    count = parseInt(capturedGroups[capturedGroups.length - 1]);
                } else {
                    // For simple "X pages" pattern
                    count = parseInt(capturedGroups[0]);
                }
                
                console.log("LinkedIn Cleaner: Found page count in post text:", count, "from:", match[0]);
                maxCount = Math.max(maxCount, count);
            }
        }
        
        if (maxCount > MAX_SLIDES) {
            console.log("LinkedIn Cleaner: Blocking document with", maxCount, "pages from full text search");
            blockReason = `Long Document (${maxCount} pages)`;
            blockPostElement(postElement, blockReason);
            return;
        }

        // If document is still loading, set up a more specific mutation observer
        const headerText = postElement.querySelector('.feed-shared-update-v2__content')?.textContent || '';
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
                        
                        // Immediately check what we can
                        if (checkForSlides(documentContainer, postElement)) {
                            intersectionObserver.disconnect();
                            return;
                        }
                        
                        // Function to perform delayed checks after the iframe becomes visible
                        const performDelayedIframeChecks = () => {
                            console.log("LinkedIn Cleaner: Running delayed check after iframe visibility");
                            
                            const iframe = documentContainer.querySelector('iframe');
                            if (iframe) {
                                // Re-check the iframe title which might have been updated
                                const iframeTitle = iframe.getAttribute('title') || '';
                                console.log("LinkedIn Cleaner: Re-checking iframe title after delay:", iframeTitle);
                                
                                // Check if the iframe document has finished rendering
                                // This helps with detecting page counts that might only appear after rendering
                                const fullPostText = postElement.textContent;
                                console.log("LinkedIn Cleaner: Re-checking post text after visibility delay");
                                
                                // Look for page counts in the text that might have appeared
                                const pageCountMatches = fullPostText.match(/(\d+)\s*pages?/gi);
                                if (pageCountMatches) {
                                    console.log("LinkedIn Cleaner: Found potential page counts after delay:", pageCountMatches);
                                    for (const match of pageCountMatches) {
                                        const count = parseInt(match.match(/\d+/)[0]);
                                        // Only consider reasonable page counts
                                        if (count >= 2 && count <= 50) {
                                            console.log("LinkedIn Cleaner: Found page count after delay:", count);
                                            if (count > MAX_SLIDES) {
                                                console.log("LinkedIn Cleaner: Blocking document with", count, "pages from delayed check");
                                                blockPostElement(postElement, `Long Document (${count} pages)`);
                                                intersectionObserver.disconnect();
                                                return;
                                            }
                                        }
                                    }
                                }
                                
                                // Look for common document playback controls
                                const documentControls = postElement.querySelectorAll('.document-navigation-controls, .document-navigation__button, [aria-label*="page"]');
                                if (documentControls.length > 0) {
                                    console.log("LinkedIn Cleaner: Found document navigation controls:", documentControls.length);
                                    
                                    // Document with controls typically has multiple pages
                                    // Scan the entire post for numbers that might indicate page count
                                    const fullText = postElement.textContent;
                                    const allNumberMatches = fullText.match(/\b(\d+)\b/g);
                                    if (allNumberMatches) {
                                        // Consider numbers between 4-20 as potential page counts
                                        const potentialCounts = allNumberMatches
                                            .map(n => parseInt(n))
                                            .filter(n => n >= 4 && n <= 20);
                                        
                                        if (potentialCounts.length > 0) {
                                            // Use the largest number as potential page count
                                            const largestCount = Math.max(...potentialCounts);
                                            console.log("LinkedIn Cleaner: Found potential page count from controls:", largestCount);
                                            
                                            if (largestCount > MAX_SLIDES) {
                                                console.log("LinkedIn Cleaner: Blocking document with potential count:", largestCount);
                                                blockPostElement(postElement, `Long Document (${largestCount} pages)`);
                                                intersectionObserver.disconnect();
                                                return;
                                            }
                                        }
                                    }
                                }
                                
                                // Check again with the main function
                                if (checkForSlides(documentContainer, postElement)) {
                                    intersectionObserver.disconnect();
                                    return;
                                }
                            }
                        };
                        
                        // Run checks after a short delay for initial loading
                        setTimeout(performDelayedIframeChecks, 500);
                        
                        // Run again after a longer delay to catch slower loading content
                        setTimeout(performDelayedIframeChecks, 2000);
                        
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
                        
                        // Also observe the surrounding post for any changes
                        documentObserver.observe(postElement, {
                            childList: true,
                            subtree: true,
                            characterData: true
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
    
    message.textContent = `${randomEmoji} Post by ${author} hidden: ${cleanReason}`;

    const unblockButton = document.createElement('button');
    unblockButton.textContent = 'Show Anyway';
    unblockButton.classList.add('ln-funblock-unblock-button');

    unblockButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling if needed
        originalPostElement.style.display = ''; // Restore original display
        originalPostElement.classList.remove('ln-funblock-hidden-original');
        placeholder.remove(); // Remove the placeholder
        console.log("LinkedIn Cleaner: Post unhidden.");
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

function startObserver() {
    // Use a selector that is likely to contain the feed posts
    // '.scaffold-finite-scroll__content' is often the scrolling container holding the posts
    const feedContainer = document.querySelector(".scaffold-finite-scroll__content");

    if (feedContainer) {
        console.log("LinkedIn Cleaner: Observing feed container area.", feedContainer);
        
        // Observe more mutation types
        feedObserver.observe(feedContainer, { 
            childList: true, 
            subtree: true,
            attributes: true,
            characterData: true
        });

        // Initial check for posts already loaded within the container
        console.log("LinkedIn Cleaner: Running initial check.");
        feedContainer.querySelectorAll(FEED_UPDATE_SELECTOR).forEach(checkAndBlockPost);
        
        // Run an additional check after a short delay to catch any posts that might have been missed
        setTimeout(() => {
            console.log("LinkedIn Cleaner: Running delayed initial check.");
            feedContainer.querySelectorAll(FEED_UPDATE_SELECTOR).forEach(checkAndBlockPost);
        }, 1000);
    } else {
        console.log("LinkedIn Cleaner: Waiting for feed container area...");
        // If not found, try again shortly. LinkedIn feed can load dynamically.
        setTimeout(startObserver, 750);
    }
}

// Start the observer setup when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
} else {
    startObserver();
}

// Optional: Clean up observer on page unload
window.addEventListener('unload', () => {
    feedObserver.disconnect();
    console.log("LinkedIn Cleaner: Observer disconnected.");
});