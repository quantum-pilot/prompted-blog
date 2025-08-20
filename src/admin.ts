// Admin dashboard entry point
import { Router } from './utils/router';
import { AdminLayout } from './components/admin-layout';
import { AdminSidebar } from './components/admin-sidebar';
import { AdminProfile } from './components/admin-profile';

// Register admin components
customElements.define('admin-layout', AdminLayout);
customElements.define('admin-sidebar', AdminSidebar);
// admin-profile is already defined in its own file

// Initialize router for admin dashboard
const router = new Router();

// Set up admin routes
router.addRoute('/admin', () => {
  // Admin dashboard home
});

router.addRoute('/admin/users', () => {
  // Admin users section
});

router.addRoute('/admin/users/:id', (event) => {
  // Admin user details - event.params.id available
});

router.addRoute('/admin/posts', () => {
  // Admin posts section
});

router.addRoute('/admin/posts/:id', (event) => {
  // Admin post details - event.params.id available
});

router.addRoute('/admin/settings', () => {
  // Admin settings
});

// Listen for navigation events
router.addEventListener('navigate', (event) => {
  const { path } = event.detail;
  
  // Update page title
  const section = path.split('/')[2] || 'dashboard';
  document.title = `Admin - ${section.charAt(0).toUpperCase() + section.slice(1)} - Prompted Blog`;
});

// Initial navigation based on current path
const currentPath = window.location.pathname;
if (currentPath.startsWith('/admin')) {
  router.navigate(currentPath + window.location.search, { replace: true });
}

// Initialize admin layout
async function initializeAdminLayout() {
  const container = document.getElementById('admin-layout');
  if (!container) return;
  
  // Clear container
  container.innerHTML = '';
  
  // Create admin layout
  const adminLayout = document.createElement('admin-layout');
  
  // Append to DOM first so component can initialize
  container.appendChild(adminLayout);
  
  // Wait for component to render its internal structure
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Create sidebar
  const sidebar = document.createElement('admin-sidebar');
  sidebar.setAttribute('slot', 'sidebar');
  
  // Create content container
  const content = document.createElement('div');
  content.setAttribute('slot', 'content');
  
  // Create admin profile for /admin/profile route
  if (window.location.pathname === '/admin/profile') {
    const profile = document.createElement('admin-profile');
    profile.setAttribute('username', 'testuser');
    profile.setAttribute('email', 'test@example.com');
    content.appendChild(profile);
  }
  
  adminLayout.appendChild(sidebar);
  adminLayout.appendChild(content);
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAdminLayout);
} else {
  initializeAdminLayout();
}

// Export router for use by admin components
export { router };