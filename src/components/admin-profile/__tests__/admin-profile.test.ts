import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../index';

describe('AdminProfile', () => {
  let container: HTMLDivElement;
  let component: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  const createComponent = (html = '<admin-profile></admin-profile>') => {
    container.innerHTML = html;
    component = container.querySelector('admin-profile')!;
    return component;
  };

  it('should extend BaseComponent and display profile heading', () => {
    createComponent();
    expect(component).toBeDefined();
    expect(component.tagName).toBe('ADMIN-PROFILE');
    expect((component as any).eventManager).toBeDefined();
    const heading = component.shadowRoot?.querySelector('h2');
    expect(heading?.textContent).toBe('User Profile');
  });

  it('should show username and email in disabled text inputs', () => {
    createComponent('<admin-profile username="johndoe" email="john@example.com"></admin-profile>');
    const usernameInput = component.shadowRoot?.querySelector('input[name="username"]') as HTMLInputElement;
    const emailInput = component.shadowRoot?.querySelector('input[name="email"]') as HTMLInputElement;
    
    expect(usernameInput.disabled).toBe(true);
    expect(usernameInput.value).toBe('johndoe');
    expect(usernameInput.type).toBe('text');
    
    expect(emailInput.disabled).toBe(true);
    expect(emailInput.value).toBe('john@example.com');
    expect(emailInput.type).toBe('text');
  });

  it('should have proper labels and data attributes', () => {
    createComponent();
    const usernameLabel = component.shadowRoot?.querySelector('label[for="username"]');
    const emailLabel = component.shadowRoot?.querySelector('label[for="email"]');
    
    expect(usernameLabel?.textContent).toBe('Username');
    expect(emailLabel?.textContent).toBe('Email');
    expect(component.getAttribute('data-component')).toBe('admin-profile');
    expect(component.shadowRoot?.querySelector('[data-profile-container]')).toBeDefined();
  });

  it('should accept username and email as properties', () => {
    createComponent();
    (component as any).username = 'janedoe';
    (component as any).email = 'jane@example.com';
    
    const usernameInput = component.shadowRoot?.querySelector('input[name="username"]') as HTMLInputElement;
    const emailInput = component.shadowRoot?.querySelector('input[name="email"]') as HTMLInputElement;
    
    expect(usernameInput.value).toBe('janedoe');
    expect(emailInput.value).toBe('jane@example.com');
  });

  it('should update display when attributes change', () => {
    createComponent('<admin-profile username="initial" email="initial@test.com"></admin-profile>');
    
    let usernameInput = component.shadowRoot?.querySelector('input[name="username"]') as HTMLInputElement;
    let emailInput = component.shadowRoot?.querySelector('input[name="email"]') as HTMLInputElement;
    
    expect(usernameInput.value).toBe('initial');
    expect(emailInput.value).toBe('initial@test.com');
    
    component.setAttribute('username', 'updated');
    component.setAttribute('email', 'updated@test.com');
    
    usernameInput = component.shadowRoot?.querySelector('input[name="username"]') as HTMLInputElement;
    emailInput = component.shadowRoot?.querySelector('input[name="email"]') as HTMLInputElement;
    
    expect(usernameInput.value).toBe('updated');
    expect(emailInput.value).toBe('updated@test.com');
  });

  it('should clean up event manager on disconnect', () => {
    createComponent();
    const eventManager = (component as any).eventManager;
    const cleanupSpy = vi.spyOn(eventManager, 'cleanup');
    
    component.remove();
    
    expect(cleanupSpy).toHaveBeenCalled();
  });
});