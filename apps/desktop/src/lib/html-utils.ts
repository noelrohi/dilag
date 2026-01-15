/**
 * Utilities for HTML manipulation and summarization
 */

/**
 * Minifies HTML by removing unnecessary whitespace.
 * Preserves content within <pre>, <code>, <script>, and <style> tags.
 */
export function minifyHtml(html: string): string {
  return html
    // Remove HTML comments (but not conditional comments)
    .replace(/<!--(?!\[)[\s\S]*?-->/g, '')
    // Collapse multiple whitespace to single space
    .replace(/\s+/g, ' ')
    // Remove whitespace between tags
    .replace(/>\s+</g, '><')
    // Remove leading/trailing whitespace
    .trim();
}

/**
 * Summarizes HTML to a shorter representation.
 * Long attribute values are truncated, and child elements are counted.
 * 
 * Example:
 * Input:  <div class="relative w-[280px] h-[572px] bg-[#1a1a1a] rounded-[44px]">...6 children...</div>
 * Output: <div class="relative w-[280px] h...">(6 elements)</div>
 */
export function summarizeHtml(html: string, maxAttrLength = 30): string {
  // Parse the HTML to get the opening tag and count children
  const tagMatch = html.match(/^<(\w+)([^>]*)>/);
  if (!tagMatch) return html.slice(0, 80) + (html.length > 80 ? '...' : '');

  const tagName = tagMatch[1];
  const attributesStr = tagMatch[2];

  // Count direct child elements (rough estimate using regex)
  const childMatches = html.match(/<(\w+)[^>]*>/g);
  const childCount = childMatches ? childMatches.length - 1 : 0; // -1 for the element itself

  // Truncate long attribute values and limit total attributes
  let attrCount = 0;
  const truncatedAttrs = attributesStr.replace(
    /(\w+)="([^"]*)"/g,
    (match, name, value) => {
      attrCount++;
      if (attrCount > 3) return ''; // Limit to 3 attributes
      if (value.length > maxAttrLength) {
        return `${name}="${value.slice(0, maxAttrLength)}..."`;
      }
      return match;
    }
  ).trim();

  const attrsDisplay = truncatedAttrs + (attrCount > 3 ? ' ...' : '');

  // Build summarized version
  if (childCount > 0) {
    return `<${tagName}${attrsDisplay ? ' ' + attrsDisplay : ''}>(${childCount} children)</${tagName}>`;
  }
  
  // For elements with no children, show text content if any
  const textContent = html.replace(/<[^>]+>/g, '').trim();
  if (textContent.length > 0) {
    const truncatedText = textContent.length > 30 
      ? textContent.slice(0, 30) + '...' 
      : textContent;
    return `<${tagName}${attrsDisplay ? ' ' + attrsDisplay : ''}>${truncatedText}</${tagName}>`;
  }

  return `<${tagName}${attrsDisplay ? ' ' + attrsDisplay : ''} />`;
}

/**
 * Creates a compact element reference with ancestry path.
 * 
 * Example output:
 * <button class="bg-primary...">Sign In</button>
 *   in div.card
 *   in section.content
 *   in main
 */
export function formatElementWithAncestry(
  html: string, 
  ancestorPath?: string[]
): string {
  const summary = summarizeHtml(html);
  
  if (!ancestorPath || ancestorPath.length === 0) {
    return summary;
  }
  
  const ancestry = ancestorPath
    .slice(0, 3) // Limit to 3 ancestors
    .map(a => `  in ${a}`)
    .join('\n');
  
  return `${summary}\n${ancestry}`;
}

/**
 * Gets a short description of an element for display in UI.
 * Returns something like "button.primary" or "div#header"
 */
export function getElementShortName(tagName: string, selector: string): string {
  // Extract meaningful parts from selector
  const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    return `${tagName}#${idMatch[1]}`;
  }

  const classMatch = selector.match(/\.([a-zA-Z0-9_-]+)/);
  if (classMatch) {
    return `${tagName}.${classMatch[1]}`;
  }

  return tagName;
}
