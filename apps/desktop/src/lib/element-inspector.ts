/**
 * Element Inspector Script
 * 
 * This module generates JavaScript code to inject into iframe srcDoc
 * that enables element hover highlighting and click selection.
 * 
 * Communication happens via postMessage to the parent window.
 */

export interface ElementInspectorMessage {
  type: "element-hover" | "element-click" | "element-leave";
  selector: string;
  html: string;
  tagName: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Ancestor path from parent to root (e.g., ["div.container", "section", "main"]) */
  ancestorPath?: string[];
}

/**
 * Generates a unique CSS selector for an element
 * Priority: ID > unique classes > nth-child path
 */
function generateSelectorCode(): string {
  return `
    function generateSelector(el) {
      if (!el || el === document.body || el === document.documentElement) {
        return 'body';
      }

      // If element has an ID, use it (most specific)
      if (el.id) {
        return '#' + CSS.escape(el.id);
      }

      // Build selector with tag name
      let selector = el.tagName.toLowerCase();

      // Add classes if they help uniqueness
      if (el.classList.length > 0) {
        const classes = Array.from(el.classList)
          .filter(c => !c.startsWith('__') && c.length < 50) // Skip generated classes
          .slice(0, 3) // Limit to 3 classes
          .map(c => '.' + CSS.escape(c))
          .join('');
        selector += classes;
      }

      // Check if this selector is unique in the document
      const matches = document.querySelectorAll(selector);
      if (matches.length === 1) {
        return selector;
      }

      // Add nth-child to make it unique
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(el) + 1;
        const parentSelector = generateSelector(parent);
        return parentSelector + ' > ' + selector + ':nth-child(' + index + ')';
      }

      return selector;
    }
  `;
}

/**
 * Generates the inspector script to inject into iframe srcDoc
 */
export function generateInspectorScript(): string {
  return `
    <script>
      (function() {
        ${generateSelectorCode()}

        // Track current hover state to avoid duplicate messages
        let currentHoverSelector = null;

        // Check if element should be ignored
        function shouldIgnore(el) {
          if (!el || el === document.body || el === document.documentElement) {
            return true;
          }
          // Ignore script, style, meta elements
          const ignoreTags = ['SCRIPT', 'STYLE', 'META', 'LINK', 'NOSCRIPT', 'HEAD'];
          if (ignoreTags.includes(el.tagName)) {
            return true;
          }
          return false;
        }

        // Get ancestor path (up to 4 levels)
        function getAncestorPath(el) {
          const path = [];
          let current = el.parentElement;
          let depth = 0;
          while (current && current !== document.body && depth < 4) {
            const tag = current.tagName.toLowerCase();
            const id = current.id ? '#' + current.id : '';
            const cls = current.classList.length > 0 ? '.' + current.classList[0] : '';
            path.push(tag + id + cls);
            current = current.parentElement;
            depth++;
          }
          return path;
        }

        // Get element info for message
        function getElementInfo(el) {
          const rect = el.getBoundingClientRect();
          return {
            selector: generateSelector(el),
            html: el.outerHTML,
            tagName: el.tagName.toLowerCase(),
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            },
            ancestorPath: getAncestorPath(el)
          };
        }

        // Send message to parent
        function sendMessage(type, el) {
          const info = getElementInfo(el);
          window.parent.postMessage({
            type: type,
            ...info
          }, '*');
        }

        // Mouse move handler
        function handleMouseMove(e) {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          
          if (shouldIgnore(el)) {
            if (currentHoverSelector) {
              window.parent.postMessage({ type: 'element-leave' }, '*');
              currentHoverSelector = null;
            }
            return;
          }

          const selector = generateSelector(el);
          if (selector !== currentHoverSelector) {
            currentHoverSelector = selector;
            sendMessage('element-hover', el);
          }
        }

        // Mouse leave handler (leaving iframe)
        function handleMouseLeave() {
          if (currentHoverSelector) {
            window.parent.postMessage({ type: 'element-leave' }, '*');
            currentHoverSelector = null;
          }
        }

        // Click handler
        function handleClick(e) {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          
          if (shouldIgnore(el)) {
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          
          sendMessage('element-click', el);
        }

        // Prevent navigation
        function handleAnchorClick(e) {
          if (e.target.closest('a')) {
            e.preventDefault();
          }
        }

        // Initialize
        document.addEventListener('mousemove', handleMouseMove, { passive: true });
        document.addEventListener('mouseleave', handleMouseLeave);
        document.addEventListener('click', handleClick, { capture: true });
        document.addEventListener('click', handleAnchorClick, { capture: true });
      })();
    </script>
  `;
}

/**
 * Generates CSS styles for the inspector (injected into head)
 */
export function generateInspectorStyles(): string {
  return `
    <style id="__dilag-inspector-styles">
      /* Prevent text selection while inspecting */
      body.inspecting {
        user-select: none;
        -webkit-user-select: none;
      }
      
      /* Cursor hint */
      body {
        cursor: default !important;
      }
      
      a, button, [role="button"], input, select, textarea {
        cursor: default !important;
      }
    </style>
  `;
}

/**
 * Injects the inspector script and styles into HTML content
 * Should be called before setting srcDoc on iframe
 */
export function injectInspector(html: string): string {
  // Inject styles into head
  const stylesInjected = html.replace(
    "</head>",
    `${generateInspectorStyles()}</head>`
  );
  
  // Inject script at end of body
  const scriptInjected = stylesInjected.replace(
    "</body>",
    `${generateInspectorScript()}</body>`
  );
  
  return scriptInjected;
}
