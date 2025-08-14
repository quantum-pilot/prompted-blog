import { OAuthFlowStart } from './components/oauth-flow-start/index.js';
import { setupOAuthHandler } from 'oauth-handler';

function registerComponents(): void {
  if (!customElements.get('oauth-flow-start')) {
    customElements.define('oauth-flow-start', OAuthFlowStart);
  }
}

function init(): void {
  registerComponents();
  setupOAuthHandler();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { registerComponents };
