// Import and register components
import './components/blog-header.js';
import './components/post-viewer.js';
import './components/revision-scroller.js';
import './components/instructions-modal.js';
import './components/diff-viewer.js';

// Import services
import { AppCoordinator } from './services/app-coordinator.js';

console.log('TypeScript components loaded!');

// Initialize app coordinator when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const coordinator = AppCoordinator.getInstance();
  await coordinator.init();
  console.log('App coordinator initialized!');
});

// Also initialize if DOM is already loaded
if (document.readyState === 'loading') {
  // DOM hasn't finished loading yet
} else {
  // DOM is already loaded
  const coordinator = AppCoordinator.getInstance();
  coordinator.init().then(() => {
    console.log('App coordinator initialized!');
  });
}