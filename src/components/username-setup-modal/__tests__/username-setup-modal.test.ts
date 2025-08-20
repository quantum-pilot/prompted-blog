import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UsernameSetupModal } from '../index';

const mockCheckAvail = vi.fn();
const mockUpdateProfile = vi.fn();
vi.mock('../../../api/profile-client', () => ({
  ProfileClient: vi.fn(() => ({
    checkUsernameAvailability: mockCheckAvail,
    updateProfile: mockUpdateProfile
  }))
}));

describe('UsernameSetupModal', () => {
  let modal: UsernameSetupModal;

  beforeEach(() => {
    if (!customElements.get('username-setup-modal')) {
      customElements.define('username-setup-modal', UsernameSetupModal);
    }
    modal = document.createElement('username-setup-modal') as UsernameSetupModal;
    document.body.appendChild(modal);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (modal?.isConnected) document.body.removeChild(modal);
    vi.clearAllTimers();
  });

  it('renders modal structure correctly', () => {
    expect(modal.querySelector('.modal-backdrop')).toBeTruthy();
    expect(modal.querySelector('.modal-card')).toBeTruthy();
    expect(modal.querySelector('h2')?.textContent).toBe('Choose Your Username');
    expect(modal.querySelector('.subtitle')?.textContent).toContain('.promptedblog.com');
    expect(modal.querySelector('input[type="text"]')).toBeTruthy();
    expect(modal.querySelector('button[type="submit"]')?.textContent).toBe('Set Username');
    expect(modal.querySelector('button')?.getAttribute('disabled')).toBe('');
    expect(modal.classList.contains('username-setup-modal')).toBe(true);
    expect(modal.dataset.component).toBe('username-setup-modal');
  });

  it('shows real-time preview and debounces checking', async () => {
    vi.useFakeTimers();
    mockCheckAvail.mockResolvedValue({ success: true, available: true });
    const input = modal.querySelector('input') as HTMLInputElement;
    const preview = modal.querySelector('.subdomain-preview');
    input.value = 'testuser';
    input.dispatchEvent(new Event('input'));
    expect(preview?.textContent).toBe('testuser.promptedblog.com');
    expect(mockCheckAvail).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    await vi.runAllTimersAsync();
    expect(mockCheckAvail).toHaveBeenCalledWith('testuser');
    vi.useRealTimers();
  });

  it('shows status indicators correctly', async () => {
    vi.useFakeTimers();
    const input = modal.querySelector('input') as HTMLInputElement;
    const btn = modal.querySelector('button') as HTMLButtonElement;
    const ind = modal.querySelector('.status-indicator');
    // Available
    mockCheckAvail.mockResolvedValue({ success: true, available: true });
    input.value = 'available';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(500);
    await vi.runAllTimersAsync();
    expect(ind?.classList.contains('available')).toBe(true);
    expect(btn.disabled).toBe(false);
    // Taken
    mockCheckAvail.mockResolvedValue({ success: true, available: false });
    input.value = 'taken';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(500);
    await vi.runAllTimersAsync();
    expect(ind?.classList.contains('taken')).toBe(true);
    expect(btn.disabled).toBe(true);
    vi.useRealTimers();
  });

  it('dispatches username-setup-complete event on successful submission', async () => {
    mockCheckAvail.mockResolvedValue({ success: true, available: true });
    mockUpdateProfile.mockResolvedValue({ success: true, user: { username: 'newuser' } });
    const eventSpy = vi.fn();
    modal.addEventListener('username-setup-complete', eventSpy);
    vi.useFakeTimers();
    const input = modal.querySelector('input') as HTMLInputElement;
    input.value = 'newuser';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(500);
    await vi.runAllTimersAsync();
    modal.querySelector('form')!.dispatchEvent(new Event('submit'));
    await vi.runAllTimersAsync();
    expect(mockUpdateProfile).toHaveBeenCalledWith('newuser');
    expect(eventSpy).toHaveBeenCalled();
    expect(eventSpy.mock.calls[0][0].detail.username).toBe('newuser');
    vi.useRealTimers();
  });
});