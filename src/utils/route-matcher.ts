export interface RouteParams {
  [key: string]: string | string[];
}

export interface RouteMatch {
  matched: boolean;
  params: RouteParams;
}

/**
 * Match a route pattern against a path
 */
export function matchRoute(pattern: string, path: string): RouteMatch {
  const params: RouteParams = {};
  
  // Normalize paths by removing trailing slashes
  const normalizedPattern = pattern.replace(/\/$/, '') || '/';
  const normalizedPath = path.replace(/\/$/, '') || '/';
  
  // Handle wildcard routes
  if (normalizedPattern.includes('*')) {
    const prefix = normalizedPattern.replace(/\/\*$/, '');
    if (normalizedPath.startsWith(prefix)) {
      const wildcard = normalizedPath.slice(prefix.length + 1);
      if (wildcard || normalizedPattern === normalizedPath) {
        params.wildcard = wildcard;
        return { matched: true, params };
      }
    }
    return { matched: false, params: {} };
  }
  
  // Split paths into segments
  const patternSegments = normalizedPattern.split('/');
  const pathSegments = normalizedPath.split('/');
  
  // Must have same number of segments
  if (patternSegments.length !== pathSegments.length) {
    return { matched: false, params: {} };
  }
  
  // Check each segment
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSegment = patternSegments[i];
    const pathSegment = pathSegments[i];
    
    if (patternSegment.startsWith(':')) {
      // Parameter segment
      const paramName = patternSegment.slice(1);
      params[paramName] = pathSegment;
    } else if (patternSegment !== pathSegment) {
      // Static segment mismatch
      return { matched: false, params: {} };
    }
  }
  
  return { matched: true, params };
}

/**
 * Parse query parameters from search string
 */
export function parseQueryParams(search: string): RouteParams {
  const params: RouteParams = {};
  const searchParams = new URLSearchParams(search);
  
  searchParams.forEach((value, key) => {
    if (params[key]) {
      // Convert to array if multiple values
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key] as string, value];
      }
    } else {
      params[key] = value;
    }
  });
  
  return params;
}