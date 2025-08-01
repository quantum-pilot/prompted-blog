// Import and register components
import './components/blog-header.js';
import './components/post-viewer.js';
import './components/revision-scroller.js';
import './components/instructions-modal.js';
import './components/diff-viewer.js';

// Import services
import { AppCoordinator } from './services/app-coordinator.js';
import { themeManager } from './utils/theme-manager.js';

console.log('TypeScript components loaded!');

// Initialize app coordinator
async function initializeApp() {
  const coordinator = AppCoordinator.getInstance();
  await coordinator.init();
  console.log('App coordinator initialized!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}