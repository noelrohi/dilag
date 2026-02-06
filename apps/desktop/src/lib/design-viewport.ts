const DEFAULT_MOBILE_VIEWPORT = {
  width: 393,
  height: 852,
};

const DEFAULT_MOBILE_ASPECT =
  DEFAULT_MOBILE_VIEWPORT.height / DEFAULT_MOBILE_VIEWPORT.width;

export function getMobileViewportSize(html: string) {
  if (!html) return DEFAULT_MOBILE_VIEWPORT;

  let width: number | null = null;
  let height: number | null = null;

  const bodyStyleMatch = html.match(/<body[^>]*style="([^"]*)"/i);
  if (bodyStyleMatch) {
    const style = bodyStyleMatch[1];
    const widthMatch = style.match(/width:\s*(\d+)px/i);
    const heightMatch = style.match(/height:\s*(\d+)px/i);
    if (widthMatch) width = Number(widthMatch[1]);
    if (heightMatch) height = Number(heightMatch[1]);
  }

  if (!width) {
    const viewportMatch = html.match(
      /<meta[^>]*name=["']viewport["'][^>]*content=["'][^"']*width=(\d+)/i
    );
    if (viewportMatch) {
      width = Number(viewportMatch[1]);
    }
  }

  const resolvedWidth = width ?? DEFAULT_MOBILE_VIEWPORT.width;
  const resolvedHeight =
    height ?? Math.round(resolvedWidth * DEFAULT_MOBILE_ASPECT);

  return {
    width: resolvedWidth,
    height: resolvedHeight,
  };
}
