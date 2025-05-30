
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractArticle") {
      const articleContent = extractArticleContent();
      sendResponse({articleContent: articleContent});
    }
    return true;
  });
  
  function extractArticleContent() {
    // Try to find the main content of the article
    // This is a simplified version that works for many sites
    
    // First, try to find article tag
    let article = document.querySelector('article');
    
    if (article) {
      return article.innerText;
    }
    
    // If no article tag, look for common content selectors
    const contentSelectors = [
      '.post-content',
      '.article-body',
      '.entry-content',
      '.content-body',
      'main',
      '#content',
      '.content'
    ];
    
    for (const selector of contentSelectors) {
      const content = document.querySelector(selector);
      if (content) {
        return content.innerText;
      }
    }
    
    // Fallback: try to find the element with the most paragraphs
    const paragraphs = document.querySelectorAll('p');
    if (paragraphs.length > 0) {
      let bestParent = null;
      let maxParagraphs = 0;
      
      const parents = {};
      for (const p of paragraphs) {
        const parent = p.parentElement;
        if (!parents[parent]) {
          parents[parent] = 0;
        }
        parents[parent]++;
        
        if (parents[parent] > maxParagraphs) {
          maxParagraphs = parents[parent];
          bestParent = parent;
        }
      }
      
      if (bestParent && maxParagraphs > 3) {
        return bestParent.innerText;
      }
    }
    
    // Last resort: return visible text from body
    return document.body.innerText;
  }