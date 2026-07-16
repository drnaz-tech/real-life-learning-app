import { supabaseConfig } from './supabase-config.js';

const hasConfig = Boolean(
  supabaseConfig.url &&
  supabaseConfig.anonKey &&
  /^https:\/\/[^\s]+\.supabase\.co(?:\/.*)?$/.test(supabaseConfig.url)
);

export const supabaseEnabled = hasConfig;
export const supabase = null;

const SESSION_KEY = 'orbit-oak-supabase-session-v1';
const observers = new Set();
let session = null;

const apiUrl = (path) => `${supabaseConfig.url}${path}`;

const jsonHeaders = (token = session?.access_token) => ({
  apikey: supabaseConfig.anonKey,
  Authorization: `Bearer ${token || supabaseConfig.anonKey}`,
  'Content-Type': 'application/json'
});

const readStoredSession = () => {
  if (!hasConfig) return null;
  try {
    const stored = window.localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const setSession = (nextSession, event = 'SIGNED_IN') => {
  session = nextSession || null;
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Private browsing can block storage; the in-memory session still works.
  }
  observers.forEach((callback) => callback(session?.user || null, session));
};

const normalizeError = (payload, fallback) => {
  const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || fallback;
  const error = new Error(message);
  error.code = payload?.code || payload?.error_code || payload?.error || '';
  error.status = payload?.status || payload?.statusCode;
  return error;
};

const request = async (path, options = {}) => {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: { ...jsonHeaders(), ...(options.headers || {}) }
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) throw normalizeError(payload, `Supabase request failed (${response.status}).`);
  return payload;
};

const requireConfig = () => {
  if (!hasConfig) throw new Error('Supabase is not configured yet. Add the project URL and publishable key to src/integrations/supabase-config.js.');
};

const appBaseUrl = () => new URL('./', window.location.href).href;

const sessionFromAuth = (payload) => {
  if (!payload?.access_token || !payload?.user) return null;
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || null,
    token_type: payload.token_type || 'bearer',
    expires_in: payload.expires_in || 3600,
    expires_at: Math.floor(Date.now() / 1000) + (payload.expires_in || 3600),
    user: payload.user
  };
};

const refreshSession = async () => {
  if (!session?.refresh_token) return null;
  const payload = await request('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  const nextSession = sessionFromAuth(payload);
  setSession(nextSession, 'TOKEN_REFRESHED');
  return nextSession;
};

const accessToken = async () => {
  requireConfig();
  if (!session) session = readStoredSession();
  if (!session) throw new Error('Your parent session has expired. Please sign in again.');
  if (session.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 30) {
    await refreshSession();
  }
  return session.access_token;
};

export const authApi = {
  observe: (callback) => {
    if (!supabaseEnabled) return { data: { subscription: { unsubscribe() {} } } };
    observers.add(callback);
    session = session || readStoredSession();
    window.setTimeout(() => callback(session?.user || null, session), 0);
    return { data: { subscription: { unsubscribe: () => observers.delete(callback) } } };
  },

  registerParent: async (email, password) => {
    requireConfig();
    const payload = await request('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, data: {}, email_redirect_to: appBaseUrl() })
    });
    const nextSession = sessionFromAuth(payload);
    if (nextSession) setSession(nextSession, 'SIGNED_IN');
    return { data: { user: payload?.user || null, session: nextSession }, error: null };
  },

  signInParent: async (email, password) => {
    requireConfig();
    const payload = await request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const nextSession = sessionFromAuth(payload);
    if (!nextSession) throw new Error('Supabase did not return a parent session.');
    setSession(nextSession, 'SIGNED_IN');
    return { data: { user: nextSession.user, session: nextSession }, error: null };
  },

  sendPasswordReset: async (email, redirectTo = appBaseUrl()) => {
    requireConfig();
    await request('/auth/v1/recover', {
      method: 'POST',
      body: JSON.stringify({ email, redirect_to: redirectTo })
    });
    return { data: {}, error: null };
  },

  signOut: async () => {
    if (session?.access_token) {
      try {
        await request('/auth/v1/logout', { method: 'POST' });
      } finally {
        setSession(null, 'SIGNED_OUT');
      }
    } else {
      setSession(null, 'SIGNED_OUT');
    }
    return { error: null };
  }
};

const remoteState = (ownerId, state) => ({
  owner_id: ownerId,
  parent_email: state.parentEmail || null,
  child: state.child || {},
  completed_mission_ids: state.completedMissionIds || [],
  submissions: Object.fromEntries(Object.entries(state.submissions || {}).map(([missionId, submission]) => [missionId, {
    missionId,
    note: submission.note || '',
    completedAt: submission.completedAt || null,
    title: submission.title || '',
    photoPath: submission.photoPath || null,
    rewardLabel: submission.rewardLabel || '',
    rewardStatus: submission.rewardStatus || 'pending',
    rewardApprovedAt: submission.rewardApprovedAt || null
  }])),
  mission_reward_overrides: state.missionRewardOverrides || {},
  mission_reward_approvals: state.missionRewardApprovals || {},
  level_rewards: state.levelRewards || {},
  approved_rewards: state.approvedRewards || {},
  last_activity_at: state.lastActivityAt || null,
  updated_at: new Date().toISOString()
});

const localState = (row) => row ? ({
  parentEmail: row.parent_email || '',
  child: row.child || {},
  completedMissionIds: row.completed_mission_ids || [],
  submissions: row.submissions || {},
  missionRewardOverrides: row.mission_reward_overrides || {},
  missionRewardApprovals: row.mission_reward_approvals || {},
  levelRewards: row.level_rewards || {},
  approvedRewards: row.approved_rewards || {},
  lastActivityAt: row.last_activity_at || null
}) : null;

const storageHeaders = (token, contentType = 'application/octet-stream') => ({
  apikey: supabaseConfig.anonKey,
  Authorization: `Bearer ${token}`,
  'Content-Type': contentType
});

export const familyApi = {
  load: async (ownerId) => {
    const token = await accessToken();
    const [familyRows, submissionRows] = await Promise.all([
      fetch(apiUrl(`/rest/v1/families?select=*&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`), {
        headers: jsonHeaders(token)
      }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw normalizeError(payload, `Could not load family data (${response.status}).`);
        return payload;
      }),
      fetch(apiUrl(`/rest/v1/mission_submissions?select=*&owner_id=eq.${encodeURIComponent(ownerId)}&order=completed_at.desc`), {
        headers: jsonHeaders(token)
      }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw normalizeError(payload, `Could not load mission activity (${response.status}).`);
        return payload;
      })
    ]);
    const family = localState(familyRows?.[0] || null);
    if (!family) return null;
    const submissions = (submissionRows || []).reduce((all, row) => ({
      ...all,
      [row.mission_id]: {
        missionId: row.mission_id,
        title: row.title || '',
        note: row.note || '',
        completedAt: row.completed_at || null,
        photoPath: row.photo_path || null,
        rewardLabel: row.reward_label || '',
        rewardStatus: row.reward_status || 'pending',
        rewardApprovedAt: row.reward_approved_at || null
      }
    }), {});
    return {
      ...family,
      completedMissionIds: [...new Set([...(family.completedMissionIds || []), ...Object.keys(submissions)])],
      submissions: { ...(family.submissions || {}), ...submissions }
    };
  },

  save: async (ownerId, state) => {
    const token = await accessToken();
    const response = await fetch(apiUrl('/rest/v1/families?on_conflict=owner_id'), {
      method: 'POST',
      headers: {
        ...jsonHeaders(token),
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(remoteState(ownerId, state))
    });
    const payload = await response.json();
    if (!response.ok) throw normalizeError(payload, `Could not save family data (${response.status}).`);
    return localState(payload?.[0] || null);
  },

  uploadMissionPhoto: async (ownerId, missionId, file) => {
    const token = await accessToken();
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
    const extension = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${ownerId}/${missionId}.${extension}`;
    const response = await fetch(apiUrl(`/storage/v1/object/mission-evidence/${path.split('/').map(encodeURIComponent).join('/')}`), {
      method: 'POST',
      headers: { ...storageHeaders(token, file.type || 'image/jpeg'), 'x-upsert': 'true' },
      body: file
    });
    if (!response.ok) throw normalizeError(await response.json(), `Could not upload photo (${response.status}).`);
    return { path };
  },

  saveMissionSubmission: async (ownerId, submission) => {
    const token = await accessToken();
    const response = await fetch(apiUrl('/rest/v1/mission_submissions?on_conflict=owner_id,mission_id'), {
      method: 'POST',
      headers: {
        ...jsonHeaders(token),
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify({
        owner_id: ownerId,
        mission_id: submission.missionId,
        title: submission.title || '',
        note: submission.note || '',
        photo_path: submission.photoPath || null,
        completed_at: submission.completedAt || new Date().toISOString(),
        reward_label: submission.rewardLabel || '',
        reward_status: submission.rewardStatus === 'approved' ? 'approved' : 'pending',
        reward_approved_at: submission.rewardApprovedAt || null,
        updated_at: new Date().toISOString()
      })
    });
    const payload = await response.json();
    if (!response.ok) throw normalizeError(payload, `Could not save mission activity (${response.status}).`);
    return payload?.[0] || null;
  },

  getMissionPhotoUrl: async (path) => {
    if (!path) return '';
    const token = await accessToken();
    const response = await fetch(apiUrl('/storage/v1/object/sign/mission-evidence'), {
      method: 'POST',
      headers: storageHeaders(token, 'application/json'),
      body: JSON.stringify({ expiresIn: 60 * 60, paths: [path] })
    });
    const payload = await response.json();
    if (!response.ok) throw normalizeError(payload, `Could not load photo (${response.status}).`);
    const signed = Array.isArray(payload) ? payload[0] : payload?.data?.[0] || payload?.data || payload;
    const signedPath = signed?.signedURL || signed?.signedUrl || signed?.path || '';
    return signedPath.startsWith('http') ? signedPath : `${supabaseConfig.url}/storage/v1${signedPath}`;
  }
};

export const authMessage = (error) => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  if (code.includes('invalid_credentials') || message.includes('invalid login')) return 'That email or password is not correct.';
  if (code.includes('user_already_exists') || message.includes('already registered')) return 'An account already exists. Try signing in instead.';
  if (code.includes('weak_password') || message.includes('password should be')) return 'Use a stronger password with at least 8 characters.';
  if (code.includes('email_not_confirmed') || message.includes('email not confirmed')) return 'Check your email to confirm your parent account first.';
  if (code.includes('rate_limit') || message.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  return error?.message || 'Something went wrong. Please try again.';
};

if (typeof window !== 'undefined' && supabaseEnabled) {
  window.addEventListener('storage', (event) => {
    if (event.key !== SESSION_KEY) return;
    session = readStoredSession();
    observers.forEach((callback) => callback(session?.user || null, session));
  });
}

