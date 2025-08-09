// OAuth integration handler
export function setupOAuthHandler(): void {
  document.addEventListener('oauth-start', async (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail?.provider === 'google') {
      
      // In development, mock the OAuth flow
      if (window.location.hostname === 'localhost') {
        console.log('Development mode: Mocking OAuth flow');
        
        // Mock successful authentication
        const mockUser = {
          id: 'dev-user-123',
          email: 'developer@example.com',
          name: 'Dev User',
          picture: 'https://via.placeholder.com/100',
          provider: 'google'
        };
        
        // Store mock user in localStorage
        localStorage.setItem('user', JSON.stringify(mockUser));
        
        // Dispatch success event
        const successEvent = new CustomEvent('oauth-success', {
          detail: { user: mockUser },
          bubbles: true
        });
        document.dispatchEvent(successEvent);
        
        console.log('Mock OAuth completed:', mockUser);
        return;
      }
      
      // Production: Real OAuth flow
      const workerUrl = 'https://worker.promptedblog.com';
      window.location.href = `${workerUrl}/oauth/google/start`;
    }
  });
  
  // Handle OAuth callback (for production)
  if (window.location.pathname === '/oauth/callback') {
    handleOAuthCallback();
  }
}

function handleOAuthCallback(): void {
  // Parse query parameters from callback
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  
  if (error) {
    console.error('OAuth error:', error);
    const errorEvent = new CustomEvent('oauth-error', {
      detail: { error },
      bubbles: true
    });
    document.dispatchEvent(errorEvent);
    return;
  }
  
  // In production, the worker would handle the callback
  // and return user data
  const userParam = params.get('user');
  if (userParam) {
    try {
      const user = JSON.parse(decodeURIComponent(userParam));
      localStorage.setItem('user', JSON.stringify(user));
      
      const successEvent = new CustomEvent('oauth-success', {
        detail: { user },
        bubbles: true
      });
      document.dispatchEvent(successEvent);
    } catch (e) {
      console.error('Failed to parse user data:', e);
    }
  }
}