// ============================================================
// SETTINGS – Uses shared i18n module
// ============================================================

import { loadDatabase } from '../Assets/js/dataService.js';
import { showToast } from '../Assets/js/toast.js';
import { applyLanguage, t } from '../Assets/js/i18n.js';
import { showLogoutModal } from '../Assets/js/ui.js';

let db = null;
let currentUser = null;

const SETTINGS_KEY = 'user_preferences';

function loadSettings() {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {}
  return { language: 'en', timezone: 'Asia/Manila', dateFormat: 'mm/dd/yyyy', density: 'comfortable', compactMode: false, reduceMotion: false };
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadUserFromStorage() {
  try {
    const data = localStorage.getItem('user');
    if (data) {
      currentUser = JSON.parse(data);
      return currentUser;
    }
  } catch (e) {}
  return null;
}

function populateProfileForm() {
  const user = currentUser || loadUserFromStorage();
  const fullNameEl = document.getElementById('full-name');
  const emailEl = document.getElementById('email-address');
  if (fullNameEl && user?.fullName) fullNameEl.value = user.fullName;
  if (emailEl && user?.email) emailEl.value = user.email;

  const roleDropdown = document.getElementById('role');
  if (roleDropdown && user?.role) {
    const items = roleDropdown.querySelectorAll('.dropdown-item');
    const selectedText = roleDropdown.querySelector('.selected-text');
    items.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.value === user.role) {
        item.classList.add('active');
        if (selectedText) selectedText.textContent = item.textContent.trim();
      }
    });
  }
}

function populatePreferences(settings) {
  // Language
  const langDropdown = document.getElementById('language');
  if (langDropdown) {
    const items = langDropdown.querySelectorAll('.dropdown-item');
    const selectedText = langDropdown.querySelector('.selected-text');
    items.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.value === settings.language) {
        item.classList.add('active');
        if (selectedText) {
          const langMap = { en: 'English', he: 'עברית' };
          selectedText.textContent = langMap[settings.language] || 'English';
        }
      }
    });
  }

  // Timezone
  const tzDropdown = document.getElementById('timezone');
  if (tzDropdown) {
    const items = tzDropdown.querySelectorAll('.dropdown-item');
    const selectedText = tzDropdown.querySelector('.selected-text');
    items.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.value === settings.timezone) {
        item.classList.add('active');
        if (selectedText) selectedText.textContent = item.textContent.trim();
      }
    });
  }

  // Date format
  const dateDropdown = document.getElementById('date-format');
  if (dateDropdown) {
    const items = dateDropdown.querySelectorAll('.dropdown-item');
    const selectedText = dateDropdown.querySelector('.selected-text');
    items.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.value === settings.dateFormat) {
        item.classList.add('active');
        if (selectedText) selectedText.textContent = item.textContent.trim();
      }
    });
  }
}

function setupLanguageChange(settings) {
  const langDropdown = document.getElementById('language');
  if (!langDropdown) return;
  langDropdown.addEventListener('dropdownChange', function(e) {
    const newLang = e.detail.value;
    settings.language = newLang;
    saveSettings(settings);
    applyLanguage();
    const langName = newLang === 'he' ? 'עברית' : 'English';
    showToast(`${t('language_changed')} ${langName}`, 'success');
  });
}

function setupTimezoneChange(settings) {
  const tzDropdown = document.getElementById('timezone');
  if (!tzDropdown) return;
  tzDropdown.addEventListener('dropdownChange', function(e) {
    const newTz = e.detail.value;
    settings.timezone = newTz;
    saveSettings(settings);
    const tzName = newTz === 'Asia/Manila' ? 'Manila (UTC+8)' : 'Israel (UTC+2/UTC+3)';
    showToast(`${t('timezone_changed')} ${tzName}`, 'success');
    window.dispatchEvent(new CustomEvent('timezoneChanged', { detail: { timezone: newTz } }));
  });
}

function setupProfileSave(settings) {
  const btn = document.getElementById('save-profile-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const fullName = document.getElementById('full-name')?.value || '';
    const email = document.getElementById('email-address')?.value || '';
    const roleDropdown = document.getElementById('role');
    const role = roleDropdown?.dataset?.value || '';
    if (!fullName || !email) {
      showToast(t('fill_fields'), 'warning');
      return;
    }
    if (currentUser) {
      currentUser.fullName = fullName;
      currentUser.email = email;
      if (role) currentUser.role = role;
      localStorage.setItem('user', JSON.stringify(currentUser));
    }
    showToast(t('profile_saved'), 'success');
  });
}

function setupPreferencesSave(settings) {
  const btn = document.getElementById('save-preferences-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const langDropdown = document.getElementById('language');
    const tzDropdown = document.getElementById('timezone');
    const dateDropdown = document.getElementById('date-format');
    settings.language = langDropdown?.dataset?.value || settings.language;
    settings.timezone = tzDropdown?.dataset?.value || settings.timezone;
    settings.dateFormat = dateDropdown?.dataset?.value || settings.dateFormat;
    saveSettings(settings);
    applyLanguage();
    showToast(t('preferences_saved'), 'success');
  });
}

function setupAppearanceSave(settings) {
  const btn = document.getElementById('save-appearance-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    settings.compactMode = settings.density === 'compact';
    settings.reduceMotion = document.getElementById('reduce-motion')?.checked || false;
    document.body.classList.toggle('compact', settings.compactMode);
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
    saveSettings(settings);
    showToast(t('appearance_saved'), 'success');
  });
  settings.density = settings.density || (settings.compactMode ? 'compact' : 'comfortable');
  const applyDensity = density => {
    settings.density = density;
    settings.compactMode = density === 'compact';
    document.body.classList.toggle('compact', settings.compactMode);
    document.querySelectorAll('[data-density-choice]').forEach(choice => {
      const selected = choice.dataset.densityChoice === density;
      choice.classList.toggle('active', selected);
      choice.setAttribute('aria-checked', String(selected));
    });
  };
  applyDensity(settings.density);
  document.querySelectorAll('[data-density-choice]').forEach(choice => {
    choice.addEventListener('click', () => {
      applyDensity(choice.dataset.densityChoice);
      saveSettings(settings);
    });
  });
  const reduceMotion = document.getElementById('reduce-motion');
  if (reduceMotion) {
    reduceMotion.checked = settings.reduceMotion || false;
    document.documentElement.classList.toggle('reduce-motion', reduceMotion.checked);
    reduceMotion.addEventListener('change', function() {
      settings.reduceMotion = this.checked;
      saveSettings(settings);
      document.documentElement.classList.toggle('reduce-motion', this.checked);
    });
  }

  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    button.classList.toggle('active', button.dataset.themeChoice === currentTheme);
    button.addEventListener('click', () => {
      const theme = button.dataset.themeChoice;
      window.runThemeTransition({
        source: button,
        update: () => {
          document.documentElement.classList.toggle('dark', theme === 'dark');
          localStorage.setItem('theme', theme);
          document.querySelectorAll('[data-theme-choice]').forEach(choice => {
            choice.classList.toggle('active', choice.dataset.themeChoice === theme);
          });
          const sidebarToggle = document.getElementById('darkModeToggle');
          if (sidebarToggle) sidebarToggle.checked = theme === 'dark';
        }
      });
    });
  });
}

function setupCalendarIntegration(settings) {
  const calendar = settings.calendar || {
    connected: false,
    account: '',
    autoSync: true,
    reminders: true,
    updateEvents: true
  };
  settings.calendar = calendar;
  const accountEl = document.getElementById('calendar-account');
  const statusEl = document.getElementById('calendar-status-text');
  const statusDot = document.getElementById('calendar-status-dot');
  const connectBtn = document.getElementById('connect-google-calendar');
  const renderConnection = () => {
    if (accountEl) accountEl.textContent = calendar.connected ? calendar.account : t('not_connected');
    if (statusEl) statusEl.textContent = calendar.connected ? t('connected') : t('not_connected');
    if (statusDot) statusDot.classList.toggle('connected', calendar.connected);
    if (connectBtn) connectBtn.textContent = calendar.connected ? t('disconnect_calendar') : t('connect_calendar');
  };

  const autoSync = document.getElementById('auto-sync-calendar');
  const reminders = document.getElementById('calendar-reminders');
  const calendarUpdate = document.getElementById('calendar-update');
  if (autoSync) autoSync.checked = calendar.autoSync !== false;
  if (reminders) reminders.checked = calendar.reminders !== false;
  if (calendarUpdate) calendarUpdate.checked = calendar.updateEvents !== false;
  renderConnection();

  if (connectBtn) {
    connectBtn.addEventListener('click', () => {
      calendar.connected = !calendar.connected;
      calendar.account = calendar.connected ? (currentUser?.email || 'demo@acerecruit.com') : '';
      saveSettings(settings);
      renderConnection();
      showToast(calendar.connected ? t('calendar_connected') : 'Google Calendar disconnected.', 'success');
    });
  }
  const testBtn = document.getElementById('test-calendar-btn');
  if (testBtn) testBtn.addEventListener('click', () => {
    showToast(calendar.connected ? t('calendar_test') : 'Connect Google Calendar before testing.', calendar.connected ? 'success' : 'warning');
  });
  const syncBtn = document.getElementById('sync-now-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      if (!calendar.connected) {
        showToast('Connect Google Calendar before syncing interviews.', 'warning');
        return;
      }
      showToast(t('syncing'), 'info');
      setTimeout(() => showToast(t('sync_complete'), 'success'), 1500);
    });
  }
  if (autoSync) autoSync.addEventListener('change', function() {
    calendar.autoSync = this.checked;
    saveSettings(settings);
    showToast(this.checked ? t('auto_sync_enabled') : t('auto_sync_disabled'), 'info');
  });
  if (reminders) reminders.addEventListener('change', function() {
    calendar.reminders = this.checked;
    saveSettings(settings);
    showToast(this.checked ? t('reminders_enabled') : t('reminders_disabled'), 'info');
  });
  if (calendarUpdate) calendarUpdate.addEventListener('change', function() {
    calendar.updateEvents = this.checked;
    saveSettings(settings);
    showToast(this.checked ? t('update_enabled') : t('update_disabled'), 'info');
  });
}

// ─── FIXED LOGOUT – uses modal ──────────────────────────────
function setupLogout(settings) {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;

  // Remove any existing listener
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener('click', function(e) {
    e.preventDefault();
    showLogoutModal(); // uses the shared modal from ui.js
  });
}

function setupTabs() {
  document.querySelectorAll('.settings-tabs .btn').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.settings-tabs .btn').forEach(function(t) {
        t.classList.remove('active-tab');
      });
      this.classList.add('active-tab');
      document.querySelectorAll('.settings-section').forEach(function(section) {
        section.style.display = 'none';
      });
      const tabId = this.getAttribute('data-tab');
      const target = document.getElementById(tabId + '-settings');
      if (target) target.style.display = 'block';
    });
  });
}

function setupAppearanceDarkToggle() {
  const btn = document.getElementById('appearance-dark-toggle');
  if (!btn) return;
  btn.addEventListener('click', function() {
    window.runThemeTransition({
      source: btn,
      update: () => {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      }
    });
  });
}

export default async function initSettings() {
  loadUserFromStorage();
  const settings = loadSettings();
  populateProfileForm();
  populatePreferences(settings);
  setupTabs();
  setupAppearanceDarkToggle();
  setupLanguageChange(settings);
  setupTimezoneChange(settings);
  setupProfileSave(settings);
  setupPreferencesSave(settings);
  setupAppearanceSave(settings);
  setupCalendarIntegration(settings);
  setupLogout(settings);
  applyLanguage();

  try {
    db = await loadDatabase();
    const nameEl = document.getElementById('recruiter-name');
    if (nameEl && db.users?.length) nameEl.textContent = db.users[0].fullName;

    console.log('✅ Settings loaded successfully');
  } catch (error) {
    console.error('Settings error:', error);
    showToast('Settings are available, but recruitment data could not be refreshed.', 'warning');
  }
}
