import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { supabaseConfig } from './supabase-config.js';

const hasConfig = Boolean(
  supabaseConfig.url &&
  supabaseConfig.anonKey &&
  /^https:\/\/[^\s]+\.supabase\.co(?:\/.*)?$/.test(supabaseConfig.url)
);

export const supabaseEnabled = hasConfig;
export const supabase = hasConfig ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
}) : null;

const requireClient = () => {
  if (!supabase) throw new Error('Supabase is not configured yet. Add the project URL and publishable key to src/integrations/supabase-config.js.');
  return supabase;
};

const appBaseUrl = () => new URL('./', window.location.href).href;

export const authApi = {
  observe: (callback) => supabase
    ? supabase.auth.onAuthStateChange((_event, session) => callback(session?.user || null, session))
    : { data: { subscription: { unsubscribe() {} } } },
  registerParent: (email, password) => requireClient().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: appBaseUrl() }
  }),
  signInParent: (email, password) => requireClient().auth.signInWithPassword({ email, password }),
  sendPasswordReset: (email, redirectTo = appBaseUrl()) => requireClient().auth.resetPasswordForEmail(email, { redirectTo }),
  signOut: () => requireClient().auth.signOut()
};

const remoteState = (ownerId, state) => ({
  owner_id: ownerId,
  parent_email: state.parentEmail || null,
  parent_pin_hash: state.parentPinHash || null,
  child: state.child || {},
  completed_mission_ids: state.completedMissionIds || [],
  submissions: Object.fromEntries(Object.entries(state.submissions || {}).map(([missionId, submission]) => [missionId, {
    missionId,
    note: submission.note || '',
    completedAt: submission.completedAt || null,
    title: submission.title || '',
    photoPath: submission.photoPath || null
  }])),
  level_rewards: state.levelRewards || {},
  approved_rewards: state.approvedRewards || {},
  last_activity_at: state.lastActivityAt || null,
  updated_at: new Date().toISOString()
});

const localState = (row) => row ? ({
  parentEmail: row.parent_email || '',
  parentPinHash: row.parent_pin_hash || '',
  child: row.child || {},
  completedMissionIds: row.completed_mission_ids || [],
  submissions: row.submissions || {},
  levelRewards: row.level_rewards || {},
  approvedRewards: row.approved_rewards || {},
  lastActivityAt: row.last_activity_at || null
}) : null;

export const familyApi = {
  load: async (ownerId) => {
    const { data, error } = await requireClient().from('families').select('*').eq('owner_id', ownerId).maybeSingle();
    if (error) throw error;
    return localState(data);
  },

  save: async (ownerId, state) => {
    const { data, error } = await requireClient().from('families').upsert(remoteState(ownerId, state), { onConflict: 'owner_id' }).select().single();
    if (error) throw error;
    return localState(data);
  },

  uploadMissionPhoto: async (ownerId, missionId, file) => {
    const client = requireClient();
    const extension = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${ownerId}/${missionId}.${extension}`;
    const { error } = await client.storage.from('mission-evidence').upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg'
    });
    if (error) throw error;
    return { path };
  },

  getMissionPhotoUrl: async (path) => {
    if (!path) return '';
    const { data, error } = await requireClient().storage.from('mission-evidence').createSignedUrl(path, 60 * 60);
    if (error) throw error;
    return data.signedUrl;
  }
};

export const authMessage = (error) => {
  const code = error?.code || '';
  if (code.includes('invalid_credentials')) return 'That email or password is not correct.';
  if (code.includes('user_already_exists')) return 'An account already exists. Try signing in instead.';
  if (code.includes('weak_password')) return 'Use a stronger password with at least 8 characters.';
  if (code.includes('email_not_confirmed')) return 'Check your email to confirm your parent account first.';
  if (code.includes('rate_limit')) return 'Too many attempts. Please wait a moment and try again.';
  return error?.message || 'Something went wrong. Please try again.';
};

