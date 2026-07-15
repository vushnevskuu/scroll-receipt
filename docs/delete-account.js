import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

var SUPABASE_URL = 'https://lqkxaykwsnrouqwsbivr.supabase.co';
var SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxa3hheWt3c25yb3Vxd3NiaXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMjM5NDMsImV4cCI6MjA5ODg5OTk0M30.jG2VKNIqxG5COasu5xGL446GXRT6x0sMBDNPXBf-pz8';

var supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

var requestPanel = document.getElementById('request-panel');
var confirmPanel = document.getElementById('confirm-panel');
var completePanel = document.getElementById('complete-panel');
var requestForm = document.getElementById('delete-request-form');
var emailInput = document.getElementById('delete-email');
var requestButton = document.getElementById('delete-request-button');
var confirmButton = document.getElementById('delete-confirm-button');
var verifiedEmail = document.getElementById('verified-email');
var statusEl = document.getElementById('delete-status');
var messageEl = document.getElementById('delete-message');
var accessToken = null;

function setState(status, message) {
  if (statusEl) statusEl.textContent = status;
  if (messageEl) messageEl.textContent = message;
}

function parseHash() {
  var value = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(value);
}

async function resolveSession() {
  var search = new URLSearchParams(window.location.search);
  var hash = parseHash();
  var hashAccessToken = hash.get('access_token');
  var hashRefreshToken = hash.get('refresh_token');

  if (hashAccessToken && hashRefreshToken) {
    var sessionResult = await supabase.auth.setSession({
      access_token: hashAccessToken,
      refresh_token: hashRefreshToken,
    });
    if (sessionResult.error || !sessionResult.data.session) {
      throw new Error(sessionResult.error?.message || 'Could not verify the deletion link.');
    }
    return sessionResult.data.session;
  }

  var code = search.get('code');
  if (code) {
    var exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error || !exchanged.data.session) {
      throw new Error(exchanged.error?.message || 'Could not verify the deletion link.');
    }
    return exchanged.data.session;
  }

  var tokenHash = search.get('token_hash') || hash.get('token_hash');
  var type = search.get('type') || hash.get('type');
  if (tokenHash && type) {
    var verified = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type });
    if (verified.error || !verified.data.session) {
      throw new Error(verified.error?.message || 'Could not verify the deletion link.');
    }
    return verified.data.session;
  }

  return null;
}

async function requestDeletion(event) {
  event.preventDefault();
  var email = emailInput?.value.trim().toLowerCase();
  if (!email) return;

  requestButton.disabled = true;
  setState('SENDING', 'Creating a secure account deletion link.');

  try {
    var redirectTo = new URL('delete-account.html?confirm=1', window.location.href).toString();
    var response = await fetch(SUPABASE_URL + '/functions/v1/send-auth-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: email,
        locale: 'en',
        redirectTo: redirectTo,
        purpose: 'delete-account',
      }),
    });
    var payload = await response.json().catch(function () {
      return {};
    });
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Could not send the deletion link.');
    }
    setState('EMAIL SENT', 'Open the secure link in your email to continue account deletion.');
  } catch (error) {
    setState('ERROR', error instanceof Error ? error.message : 'Could not send the deletion link.');
  } finally {
    requestButton.disabled = false;
  }
}

async function showConfirmation(session) {
  var userResult = await supabase.auth.getUser(session.access_token);
  if (userResult.error || !userResult.data.user?.email) {
    throw new Error(userResult.error?.message || 'Could not verify this account.');
  }

  accessToken = session.access_token;
  requestPanel.hidden = true;
  confirmPanel.hidden = false;
  verifiedEmail.textContent = userResult.data.user.email;
  window.history.replaceState({}, document.title, window.location.pathname + '?confirm=1');
  setState('VERIFIED', 'Review the final confirmation, then delete the account permanently.');
}

async function deleteAccount() {
  if (!accessToken) return;
  confirmButton.disabled = true;
  setState('DELETING', 'Permanently deleting the account and synced data.');

  try {
    var response = await fetch(SUPABASE_URL + '/functions/v1/delete-account', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + accessToken,
      },
    });
    var payload = await response.json().catch(function () {
      return {};
    });
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Could not delete the account.');
    }

    accessToken = null;
    confirmPanel.hidden = true;
    completePanel.hidden = false;
    window.history.replaceState({}, document.title, window.location.pathname);
    setState('DELETED', 'Your account and associated server data have been deleted.');
  } catch (error) {
    setState('ERROR', error instanceof Error ? error.message : 'Could not delete the account.');
    confirmButton.disabled = false;
  }
}

async function boot() {
  requestForm?.addEventListener('submit', requestDeletion);
  confirmButton?.addEventListener('click', deleteAccount);

  try {
    var session = await resolveSession();
    if (session) await showConfirmation(session);
  } catch (error) {
    setState(
      'ERROR',
      error instanceof Error ? error.message : 'This deletion link is invalid or expired.',
    );
  }
}

void boot();
