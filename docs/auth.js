import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

var SUPABASE_URL = 'https://lqkxaykwsnrouqwsbivr.supabase.co';
var SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxa3hheWt3c25yb3Vxd3NiaXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMjM5NDMsImV4cCI6MjA5ODg5OTk0M30.jG2VKNIqxG5COasu5xGL446GXRT6x0sMBDNPXBf-pz8';

var statusEl = document.getElementById('auth-status');
var messageEl = document.getElementById('auth-message');
var returnLink = document.getElementById('auth-return');

function setState(status, message) {
  if (statusEl) statusEl.textContent = status;
  if (messageEl) messageEl.textContent = message;
}

function getSearchParams() {
  return new URLSearchParams(window.location.search);
}

function getHashParams() {
  var hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(hash);
}

async function resolveSession() {
  var hash = getHashParams();
  var search = getSearchParams();

  var accessToken = hash.get('access_token');
  var refreshToken = hash.get('refresh_token');
  var expiresAt = hash.get('expires_at');

  if (accessToken && refreshToken) {
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt ? Number(expiresAt) : undefined,
    };
  }

  var supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  var code = search.get('code');
  if (code) {
    var exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error || !exchanged.data.session) {
      throw new Error(exchanged.error?.message || 'Could not exchange auth code');
    }
    return {
      access_token: exchanged.data.session.access_token,
      refresh_token: exchanged.data.session.refresh_token,
      expires_at: exchanged.data.session.expires_at,
    };
  }

  var tokenHash = search.get('token_hash') || hash.get('token_hash');
  var type = search.get('type') || hash.get('type');
  if (tokenHash && type) {
    var verified = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type,
    });
    if (verified.error || !verified.data.session) {
      throw new Error(verified.error?.message || 'Could not verify sign-in link');
    }
    return {
      access_token: verified.data.session.access_token,
      refresh_token: verified.data.session.refresh_token,
      expires_at: verified.data.session.expires_at,
    };
  }

  throw new Error('No session data found in this link');
}

async function sendSessionToExtension(session) {
  var search = getSearchParams();
  var extId = search.get('extId');
  var email = search.get('email');

  if (!extId) {
    throw new Error('Extension id missing in auth link');
  }

  if (!window.chrome?.runtime?.sendMessage) {
    throw new Error('Chrome could not connect this page to the extension');
  }

  var response = await new Promise(function (resolve, reject) {
    try {
      window.chrome.runtime.sendMessage(
        extId,
        {
          type: 'AUTH_SESSION_FROM_PAGE',
          payload: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            email: email,
          },
        },
        function (reply) {
          var runtimeError = window.chrome.runtime.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message));
            return;
          }
          resolve(reply);
        },
      );
    } catch (error) {
      reject(error);
    }
  });

  if (!response || !response.ok) {
    throw new Error(response?.error || 'Extension rejected the auth session');
  }

  if (returnLink) {
    returnLink.href = 'chrome-extension://' + extId + '/options.html';
    returnLink.textContent = 'Return to extension';
  }
}

async function boot() {
  try {
    setState('VERIFYING', 'Checking your sign-in link.');
    var session = await resolveSession();
    setState('CONNECTING', 'Sending the verified session back to the extension.');
    await sendSessionToExtension(session);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    setState('DONE', 'Email verified. You can return to the extension and start receiving receipts.');
  } catch (error) {
    setState(
      'ERROR',
      error instanceof Error
        ? error.message
        : 'Could not finish email sign-in. Return to the extension and try again.',
    );
  }
}

void boot();
