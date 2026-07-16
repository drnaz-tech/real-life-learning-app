import { BADGES, LEVELS, MISSIONS, getLevel, getMission } from './data/missions.js';
import { clearProgress, completionCount, currentMissionId, getLevelProgress, hasCompleted, isMissionOpen, loadState, saveState, totalXp } from './state.js';
import { authApi, authMessage, familyApi, supabaseEnabled } from './integrations/supabase-service.js?version=9';

const app = document.getElementById('app');
const toast = document.getElementById('toast');
const state = loadState();

let route = 'login';
let sessionRole = null;
let pinMode = 'setup';
let toastTimer;
let modal = null;
let authUser = null;
let authError = '';
let authBusy = false;
let hydratedOwnerId = null;

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const formatDate = (date) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(date));
const currentMission = () => { const id = currentMissionId(MISSIONS, state); return id ? getMission(id) : null; };
const currentLevel = () => currentMission()?.level || 'expert';
const childName = () => state.child.name || 'Explorer';
const earnedLevelBadge = (levelId) => Boolean(state.levelRewards[levelId]);
const missionReward = (mission) => state.missionRewardOverrides?.[mission.id] || mission.reward;
const missionRewardApproval = (missionId) => state.missionRewardApprovals?.[missionId] || null;
const hasEarnedBadge = (badge) => badge.id === 'first-launch' ? completionCount(state) >= 1 : badge.id === 'curious-hands' ? completionCount(state) >= 3 : badge.id === 'great-observer' ? completionCount(state) >= 5 : earnedLevelBadge(badge.level);
const earnedBadgeCount = () => BADGES.filter(hasEarnedBadge).length;
const completionStreak = () => {
  const days = new Set(Object.values(state.submissions || {}).map((item) => item.completedAt && new Date(item.completedAt).toDateString()).filter(Boolean));
  let streak = 0; const cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  while (days.has(cursor.toDateString())) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  return streak;
};
const requireAuthenticatedFamily = () => Boolean(authUser && hydratedOwnerId === authUser.id && state.child.profileComplete);
const showToast = (message) => { toast.textContent = message; toast.classList.add('show'); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3000); };
const goTo = (nextRoute) => { modal = null; authError = ''; route = nextRoute; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
const childRoute = () => state.child.profileComplete ? 'child-home' : 'child-home';

const persistState = async ({ strict = false } = {}) => {
  saveState(state);
  if (!supabaseEnabled || !authUser) return;
  try {
    await familyApi.save(authUser.id, state);
  } catch (error) {
    showToast('Saved on this device. Cloud sync needs attention.');
    console.error('Supabase sync failed', error);
    if (strict) throw error;
  }
};

const hydrateState = async (user) => {
  if (!user) return;
  try {
    const remote = await familyApi.load(user.id);
    if (remote) {
      Object.assign(state, remote, { version: 1, parentEmail: user.email || remote.parentEmail || state.parentEmail });
      state.child = { ...state.child, ...(remote.child || {}) };
      await Promise.all(Object.entries(state.submissions || {}).map(async ([missionId, submission]) => {
        if (!submission.photoPath || submission.photoData || submission.photoUrl) return;
        try {
          submission.photoUrl = await familyApi.getMissionPhotoUrl(submission.photoPath);
        } catch (photoError) {
          console.warn('Mission photo could not be loaded', missionId, photoError);
        }
      }));
      saveState(state);
    } else {
      Object.assign(state, clearProgress(state), { parentEmail: user.email || '', child: { name: '', age: 8, theme: 'Space Explorers', profileComplete: false }, missionRewardOverrides: {}, missionRewardApprovals: {} });
      saveState(state);
    }
    hydratedOwnerId = user.id;
  } catch (error) {
    console.error('Supabase load failed', error);
    showToast('Cloud data could not load. Your device copy is still available.');
  }
};

const startAuthObserver = () => {
  if (!supabaseEnabled) return;
  authApi.observe((user) => {
    authUser = user;
    if (!user) {
      hydratedOwnerId = null;
      render();
      return;
    }
    if (route === 'login') route = 'roles';
    window.setTimeout(async () => {
      await hydrateState(user);
      render();
    }, 0);
  });
};

const pinBytes = (value) => Array.from(new Uint8Array(value)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const createPinRecord = async (pin) => {
  if (!globalThis.crypto?.subtle) throw new Error('Use a modern browser to create a secure family PIN.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256);
  return `v2.${pinBytes(salt)}.${pinBytes(hash)}`;
};
const verifyPinRecord = async (pin, record) => {
  if (record?.startsWith('v2.')) {
    const [, saltHex, hashHex] = record.split('.');
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map((part) => parseInt(part, 16)));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const hash = pinBytes(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256));
    return hash === hashHex;
  }
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return pinBytes(bytes) === record;
};

const navButton = (view, icon, label, active) => `<button class="nav-button ${active ? 'active' : ''}" type="button" data-action="child-nav" data-view="${view}" aria-current="${active ? 'page' : 'false'}"><span aria-hidden="true">${icon}</span>${label}</button>`;
const childNav = (active) => `<nav class="bottom-nav" aria-label="Child navigation">${navButton('child-home', '⌂', 'Home', active === 'child-home')}${navButton('missions', '✦', 'Missions', active === 'missions')}${navButton('badges', '🏅', 'Badges', active === 'badges')}</nav>`;
const flowSteps = (active) => `<ol class="flow-steps" aria-label="Family setup progress"><li class="${active === 'account' ? 'active' : active === 'role' || active === 'secure' || active === 'profile' ? 'complete' : ''}"><span>1</span>Account</li><li class="${active === 'role' ? 'active' : active === 'secure' || active === 'profile' ? 'complete' : ''}"><span>2</span>Role</li><li class="${active === 'secure' ? 'active' : active === 'profile' ? 'complete' : ''}"><span>3</span>Secure</li><li class="${active === 'profile' ? 'active' : ''}"><span>4</span>Profile</li></ol>`;

const renderHeader = () => `<header class="topbar"><a class="brand" href="#" data-action="brand-home" aria-label="Orbit and Oak home"><span class="brand-mark" aria-hidden="true"></span><span>orbit &amp; oak</span></a>${authUser || sessionRole ? `<button class="topbar-action" type="button" data-action="sign-out">Sign out</button>` : ''}</header>`;
const renderLandingClimb = () => `<div class="landing-climb" aria-label="The 49-mission climb from Easy to Expert"><div class="landing-climb-heading"><div><strong>The 49-mission climb</strong><span>One real-world step at a time</span></div><span class="landing-climb-total">49 stops</span></div><div class="landing-route"><div class="landing-route-line"></div>${LEVELS.map((level, index) => `<div class="landing-route-stop ${level.color}"><span>${level.icon}</span><div><strong>${level.name}</strong><small>${index === 0 ? 'Start curious' : index === 1 ? 'Try a little more' : index === 2 ? 'Make it matter' : 'Reach the stars'}</small></div></div>`).join('')}</div></div>`;

const renderLogin = () => `<section class="screen entry-layout" aria-labelledby="login-title"><div class="entry-copy"><p class="eyebrow">Learning that leaves the screen</p><h1 id="login-title">Small missions.<br /><span class="accent-text">Big real life.</span></h1><p>Orbit &amp; Oak turns a child’s interests into things they can make, notice, build, and share at home.</p><div class="promise-list"><div class="promise"><span class="promise-icon">✍️</span><span>49 hands-on missions, from easy to expert</span></div><div class="promise"><span class="promise-icon peach-bg">🔒</span><span>Parents stay in control; kids need no email</span></div><div class="promise"><span class="promise-icon yellow-bg">🌳</span><span>Rewards always point back to real life</span></div></div>${renderLandingClimb()}</div><div class="card entry-card"><div class="orbit-scene" aria-hidden="true"><div class="ring"></div><div class="planet"></div><div class="moon"></div><div class="scene-caption">A new kind of screen time<span>Start with a grown-up account.</span></div></div><h2>Welcome to the family</h2><p>Parents use their email to set up the family. Your child can join without sharing personal details.</p><form class="entry-form" data-form="login"><div><label class="form-label" for="parent-email">Parent email</label><input class="form-control" id="parent-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" value="${escapeHtml(state.parentEmail)}" required /><p class="form-help">Used only for the grown-up account and recovery.</p></div>${supabaseEnabled ? `<div><label class="form-label" for="parent-password">Parent password</label><input class="form-control" id="parent-password" name="password" type="password" minlength="8" autocomplete="current-password" placeholder="At least 8 characters" required /></div><p class="form-help auth-note">${authBusy ? 'Connecting securely…' : 'Use your parent account to sync progress across devices.'}</p><p class="pin-status" id="auth-status" role="status">${escapeHtml(authError)}</p><div class="pin-actions"><button class="btn btn-primary entry-button" type="submit" data-auth-mode="signin">Sign in <span aria-hidden="true">→</span></button><button class="btn btn-light" type="submit" data-auth-mode="signup">Create account</button></div><button class="btn btn-quiet" type="button" data-action="reset-password">Forgot password?</button>` : `<button class="btn btn-primary entry-button" type="submit">Continue as parent <span aria-hidden="true">→</span></button><p class="form-help auth-note">Offline preview mode. Add Supabase credentials to enable real parent accounts.</p>`}</form><div class="divider">or</div><button class="child-access" type="button" data-action="show-roles">I’m a child — take me to my dashboard <span aria-hidden="true">→</span></button></div></section>`;

const renderRoles = () => `<section class="screen flow-narrow" aria-labelledby="role-title">${flowSteps('role')}<p class="eyebrow">Family access</p><h1 id="role-title">Who’s exploring<br />today?</h1><p class="flow-intro">Choose the space that fits. Kids go straight to missions; grown-ups get the family controls.</p><div class="role-grid"><button class="role-card parent" type="button" data-action="parent-role"><span class="role-icon">🌿</span><h2>Parent space</h2><p>Set up a profile, see activity, and approve real-life rewards.</p><span class="btn btn-primary">Open parent space →</span></button><button class="role-card child" type="button" data-action="child-role"><span class="role-icon">🚀</span><h2>Child space</h2><p>Pick up your next mission and keep your adventure moving.</p><span class="btn btn-light">Go to my missions →</span></button></div><button class="btn btn-quiet back-link" type="button" data-action="back-login">← Back to sign in</button></section>`;

const renderPin = () => { const setup = pinMode === 'setup'; return `<section class="screen flow-narrow" aria-labelledby="pin-title">${flowSteps('secure')}<p class="eyebrow">${setup ? 'First-time setup' : 'Welcome back'}</p><h1 id="pin-title">${setup ? 'A tiny lock<br />for a big job.' : 'Good to see<br />you again.'}</h1><p class="flow-intro">${setup ? 'Set a 4-digit family PIN. Your child never needs to know it.' : 'Enter the family PIN to open the grown-up dashboard.'}</p><form class="card pin-card" data-form="pin"><div class="pin-mark" aria-hidden="true">🔐</div><h2>${setup ? 'Create your family PIN' : 'Enter your family PIN'}</h2><p class="muted">${setup ? 'Use something memorable for the grown-ups in your family. You can change it later in settings.' : 'This keeps grown-up controls separate from your child’s missions.'}</p><label class="form-label" for="pin-input">${setup ? 'New 4-digit PIN' : '4-digit family PIN'}</label><input class="form-control pin-input" id="pin-input" name="pin" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="••••" autocomplete="off" required />${setup ? `<label class="form-label" for="confirm-pin-input">Confirm PIN</label><input class="form-control pin-input" id="confirm-pin-input" name="confirmPin" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="••••" autocomplete="off" required />` : ''}<p class="pin-status" id="pin-status" role="status"></p><div class="pin-actions"><button class="btn btn-quiet" type="button" data-action="back-roles">Go back</button><button class="btn btn-primary" type="submit">${setup ? 'Save and continue →' : 'Open parent space →'}</button></div></form></section>`; };

const renderProfileSetup = () => `<section class="screen flow-narrow" aria-labelledby="profile-title">${flowSteps('profile')}<p class="eyebrow">${state.child.profileComplete ? 'Child profile' : 'Family setup'}</p><h1 id="profile-title">Make it feel<br />like theirs.</h1><p class="flow-intro">Set up a simple child profile. No child email, phone number, or personal account is needed.</p><form class="card profile-setup-card" data-form="profile"><div class="profile-setup-icon" aria-hidden="true">🧑🏽‍🚀</div><h2>${state.child.profileComplete ? 'Edit child profile' : 'Create child profile'}</h2><div class="profile-form-grid"><div><label class="form-label" for="child-name">Child’s first name or nickname</label><input class="form-control" id="child-name" name="name" value="${escapeHtml(state.child.name)}" placeholder="Maya" autocomplete="off" required /></div><div><label class="form-label" for="child-age">Age</label><select class="form-control" id="child-age" name="age"><option value="5" ${state.child.age === 5 ? 'selected' : ''}>5</option><option value="6" ${state.child.age === 6 ? 'selected' : ''}>6</option><option value="7" ${state.child.age === 7 ? 'selected' : ''}>7</option><option value="8" ${state.child.age === 8 ? 'selected' : ''}>8</option><option value="9" ${state.child.age === 9 ? 'selected' : ''}>9</option><option value="10" ${state.child.age === 10 ? 'selected' : ''}>10</option><option value="11" ${state.child.age === 11 ? 'selected' : ''}>11</option><option value="12" ${state.child.age === 12 ? 'selected' : ''}>12</option></select></div></div><label class="form-label" for="child-theme">Choose a starting theme</label><select class="form-control" id="child-theme" name="theme"><option ${state.child.theme === 'Space Explorers' ? 'selected' : ''}>Space Explorers</option><option ${state.child.theme === 'Wild Detectives' ? 'selected' : ''}>Wild Detectives</option><option ${state.child.theme === 'Mini Inventors' ? 'selected' : ''}>Mini Inventors</option><option ${state.child.theme === 'Story Makers' ? 'selected' : ''}>Story Makers</option></select><p class="profile-note">The theme changes the story around the missions. The 49-mission learning path stays consistent.</p><div class="pin-actions"><button class="btn btn-quiet" type="button" data-action="back-roles">Go back</button><button class="btn btn-primary" type="submit">Save child profile →</button></div></form></section>`;

const renderProgressBar = (label = '49-mission trail') => { const done = completionCount(state); const percentage = Math.round((done / MISSIONS.length) * 100); return `<div class="progress-card card"><div class="section-heading"><h3>Your ${label}</h3><small>${done} / ${MISSIONS.length} complete</small></div><div class="progress-track" role="progressbar" aria-label="${done} of ${MISSIONS.length} missions complete" aria-valuemin="0" aria-valuemax="49" aria-valuenow="${done}"><div class="progress-fill" style="width: ${percentage}%"></div></div><div class="progress-meta"><span>Launch pad</span><span>Expert orbit</span></div></div>`; };

const renderMissionHero = () => { const mission = currentMission(); if (!mission) return `<article class="card mission-hero complete-hero"><span class="hero-check" aria-hidden="true">✓</span><p class="eyebrow">All 49 missions complete</p><h2>You made your<br />own orbit.</h2><p>You noticed, built, tested, wrote, and shared your way through every level. A grown-up reward is ready in Parent space.</p><button class="btn btn-primary" type="button" data-action="parent-from-child">See the family reward →</button></article>`; const level = getLevel(mission.level); return `<article class="card mission-hero"><div class="mission-top"><span class="mission-count">MISSION ${String(mission.order).padStart(2, '0')} OF 49 · ${level.name.toUpperCase()}</span><span class="xp-pill">+${level.xp} points</span></div><div class="mission-copy"><h2>${escapeHtml(mission.title)}</h2><p>${escapeHtml(mission.hook)}</p><div class="objective"><div class="objective-icon" aria-hidden="true">${mission.icon}</div><div><strong>What you’ll need</strong><span>${mission.materials.map(escapeHtml).join(' · ')}</span></div></div><div class="mission-actions"><button class="btn btn-primary" type="button" data-action="open-mission" data-mission-id="${mission.id}">See the mission <span aria-hidden="true">→</span></button><button class="btn btn-light" type="button" data-action="skip-mission">Maybe later</button></div></div><div class="orbit-doodle" aria-hidden="true"><span class="star one">✦</span><span class="star two">✧</span><span class="star three">·</span><div class="ring"></div><div class="planet"></div></div></article>`; };

const renderChildHome = () => { const level = getLevel(currentLevel()); return `<section class="screen" aria-labelledby="child-home-title"><div class="app-heading"><div><p class="eyebrow">Mission control</p><h1 id="child-home-title">Hey, ${escapeHtml(childName())} <span aria-hidden="true">✦</span></h1><p>${escapeHtml(state.child.theme)} · ${level.name} level</p></div><div class="profile-chip"><div class="mini-avatar" aria-hidden="true">🧑🏽‍🚀</div><div><strong>Explorer level ${Math.min(4, Math.floor(completionCount(state) / 13) + 1)}</strong><span>${totalXp(MISSIONS, state, LEVELS)} star points</span></div></div></div><div class="child-layout"><div>${renderMissionHero()}</div><div class="child-side">${renderProgressBar()}<article class="card streak-card"><h3><span class="flame" aria-hidden="true">🔥</span> Four-day streak!</h3><p>Keep your explorer boots on today to unlock a bonus badge.</p></article><article class="card badge-card"><div class="section-heading"><h3>Badge shelf</h3><button class="linkish" type="button" data-action="child-nav" data-view="badges">See all</button></div><div class="badge-row">${BADGES.slice(0, 4).map((badge) => `<div class="badge ${earnedLevelBadge(badge.level) || badge.kind === 'earned' ? 'earned' : 'locked'}" aria-label="${badge.name}">${badge.icon}</div>`).join('')}</div><p class="tiny-note">${BADGES.filter((badge) => badge.kind === 'earned' || earnedLevelBadge(badge.level)).length} badges earned</p></article></div></div>${childNav('child-home')}</section>`; };

const renderMissionPath = () => `<div class="climb-path" aria-label="49 mission climb path">${LEVELS.map((le…2836 tokens truncated… ${escapeHtml(mission.title)}</strong><input class="form-control" id="mission-reward-${mission.id}" value="${escapeHtml(missionReward(mission))}" aria-label="Reward for ${escapeHtml(mission.title)}" /><span>${submission ? (approval ? 'Approved for real life ✓' : 'Mission complete · reward pending') : 'Locked until this mission is completed'}</span></div><div class="reward-actions"><button class="btn btn-light" type="button" data-action="save-mission-reward" data-mission-id="${mission.id}">Save</button>${submission && !approval ? `<button class="btn btn-primary" type="button" data-action="approve-mission-reward" data-mission-id="${mission.id}">Approve</button>` : ''}</div></div>`; }).join('')}</div></section>`;
const enhanceRenderedView = () => {
  if (route === 'child-home') { const streak = completionStreak(); const heading = document.querySelector('.streak-card h3'); if (heading) heading.innerHTML = `<span class="flame" aria-hidden="true">🔥</span> ${streak ? `${streak}-day streak!` : 'Start a streak today!'}`; const note = document.querySelector('.badge-card .tiny-note'); if (note) note.textContent = `${earnedBadgeCount()} badges earned`; document.querySelectorAll('.badge-row .badge').forEach((element, index) => element.classList.toggle('earned', hasEarnedBadge(BADGES[index]))); }
  if (route === 'badges') document.querySelectorAll('.badge-page-card').forEach((element, index) => { const earned = hasEarnedBadge(BADGES[index]); element.classList.toggle('locked', !earned); const status = element.querySelector('.badge-status'); if (status) status.textContent = earned ? 'Earned' : 'Locked'; });
  if (route !== 'parent') return;
  const stats = document.querySelectorAll('.overview-stat strong'); if (stats[1]) stats[1].textContent = completionStreak(); if (stats[2]) stats[2].textContent = earnedBadgeCount(); const account = document.querySelector('.parent-email strong'); if (account) account.textContent = state.parentEmail || authUser?.email || 'Signed-in parent';
  const approvalCard = document.querySelector('.approval-card'); if (approvalCard) { const pending = MISSIONS.filter((mission) => state.submissions[mission.id] && !missionRewardApproval(mission.id)); approvalCard.innerHTML = `<p class="eyebrow">Real-life rewards</p><h2>Mission reward queue</h2><p>Every finished mission appears here as pending until a grown-up approves it.</p><div class="reward-list">${pending.length ? pending.slice(0, 5).map((mission) => `<div class="reward-row unlocked"><div class="reward-icon">${mission.icon}</div><div><strong>${escapeHtml(mission.title)}</strong><span>${escapeHtml(missionReward(mission))}</span></div><button class="btn btn-primary" type="button" data-action="approve-mission-reward" data-mission-id="${mission.id}">Approve</button></div>`).join('') : '<div class="empty-state"><span aria-hidden="true">🌱</span><strong>No rewards waiting yet.</strong><p>Complete a mission to bring its reward here.</p></div>'}</div><button class="btn btn-light" type="button" data-action="open-reward-planner">Edit all 49 rewards</button>`; }
  const entries = Object.entries(state.submissions || {}).sort(([, a], [, b]) => new Date(b.completedAt) - new Date(a.completedAt)); document.querySelectorAll('.activity-item').forEach((element, index) => { const missionId = entries[index]?.[0]; if (!missionId) return; const status = document.createElement('span'); status.className = missionRewardApproval(missionId) ? 'approved-label' : 'locked-label'; status.textContent = missionRewardApproval(missionId) ? 'Reward approved ✓' : 'Reward pending'; element.append(status); });
};
const readFile = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });

const openMission = (missionId) => { const mission = getMission(missionId); if (!mission) return; if (!isMissionOpen(MISSIONS, state, mission)) { showToast('Finish the earlier missions to unlock this one.'); return; } const submission = state.submissions[missionId]; modal = { missionId, checkedSteps: hasCompleted(state, missionId) ? mission.steps.map((_, index) => index) : [], photoData: submission?.photoData || '', photoFile: null, note: submission?.note || '', message: '' }; render(); };

const completeMission = async () => { if (!modal) return; const mission = getMission(modal.missionId); if (modal.checkedSteps.length !== mission.steps.length) { modal.message = 'Check off each real-world step before completing the mission.'; render(); return; } if (!modal.photoData) { modal.message = 'Add a photo of what you made so your mission can come back into the story.'; render(); return; } const wasCompleted = hasCompleted(state, mission.id); if (wasCompleted) { modal = null; render(); return; } let photoPath = state.submissions[mission.id]?.photoPath || null; if (supabaseEnabled && authUser && modal.photoFile) { try { photoPath = (await familyApi.uploadMissionPhoto(authUser.id, mission.id, modal.photoFile)).path; } catch (error) { modal.message = 'The photo could not be uploaded. Check your connection and try again.'; console.error('Supabase photo upload failed', error); render(); return; } } state.completedMissionIds = [...state.completedMissionIds, mission.id].sort((a, b) => getMission(a).order - getMission(b).order); state.submissions[mission.id] = { photoData: modal.photoData, photoPath, note: modal.note, completedAt: new Date().toISOString(), title: mission.title }; state.lastActivityAt = new Date().toISOString(); const progress = getLevelProgress(MISSIONS, state, mission.level); if (progress.isComplete) state.levelRewards[mission.level] = { unlockedAt: new Date().toISOString(), reward: getLevel(mission.level).reward }; await persistState(); const finishedLevel = progress.isComplete ? ` ${getLevel(mission.level).name} level reward unlocked!` : ''; modal = null; render(); showToast(`Mission complete! +${getLevel(mission.level).xp} points.${finishedLevel}`); };

const handleSubmit = async (form, submitterMode = 'signin') => { const formName = form.dataset.form; const data = new FormData(form); if (formName === 'login') { const email = String(data.get('email') || '').trim(); const password = String(data.get('password') || ''); if (!email) return; if (!supabaseEnabled) { state.parentEmail = email; saveState(state); route = 'roles'; render(); return; } if (password.length < 8) { authError = 'Use a password with at least 8 characters.'; render(); return; } authBusy = true; authError = ''; render(); try { const response = submitterMode === 'signup' ? await authApi.registerParent(email, password) : await authApi.signInParent(email, password); if (!response.data.session) { authError = 'Account created. Check your email to confirm it, then sign in.'; authBusy = false; render(); return; } authUser = response.data.user; state.parentEmail = email; await persistState(); authBusy = false; route = 'roles'; render(); } catch (error) { authBusy = false; authError = authMessage(error); render(); } return; } if (formName === 'profile') { const name = String(data.get('name') || '').trim(); if (!name) return; state.child = { ...state.child, name, age: Number(data.get('age') || 8), theme: String(data.get('theme') || 'Space Explorers'), profileComplete: true }; await persistState(); sessionRole = 'parent'; route = 'parent'; render(); showToast('Child profile saved. The adventure is ready.'); return; } if (formName === 'pin') { const pin = String(data.get('pin') || ''); const status = document.getElementById('pin-status'); if (!/^\d{4}$/.test(pin)) { status.textContent = 'Please enter exactly 4 numbers.'; return; } const pinHash = await hashPin(pin); if (pinMode === 'setup') { const confirmPin = String(data.get('confirmPin') || ''); if (pin !== confirmPin) { status.textContent = 'Those PINs do not match yet.'; return; } state.parentPinHash = pinHash; await persistState(); sessionRole = 'parent'; route = 'profile-setup'; render(); showToast('Family PIN saved. Now create the child profile.'); } else if (pinHash === state.parentPinHash) { sessionRole = 'parent'; route = state.child.profileComplete ? 'parent' : 'profile-setup'; render(); showToast('Parent space unlocked.'); } else { status.textContent = 'That PIN doesn’t match. Try again.'; } } };

const handleSubmitSafe = async (form, submitterMode = form.dataset.submitterMode || 'signin') => {
  const formName = form.dataset.form;
  const data = new FormData(form);
  if (formName === 'login') {
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    if (!email) { authError = 'Enter the parent email first.'; render(); return; }
    if (!supabaseEnabled) { state.parentEmail = email; saveState(state); goTo('roles'); return; }
    if (password.length < 8) { authError = 'Use a password with at least 8 characters.'; render(); return; }
    authBusy = true;
    authError = '';
    render();
    try {
      const response = submitterMode === 'signup' ? await authApi.registerParent(email, password) : await authApi.signInParent(email, password);
      state.parentEmail = email;
      saveState(state);
      if (!response?.data?.session) {
        authError = submitterMode === 'signup' ? 'Account created. Check your email to confirm it, then sign in.' : 'Your session could not be opened. Check your email and password.';
        authBusy = false;
        render();
        return;
      }
      authUser = response.data.user;
      authBusy = false;
      goTo('roles');
      showToast('Signed in securely. Choose your space.');
    } catch (error) {
      authBusy = false;
      authError = authMessage(error);
      render();
    }
    return;
  }
  if (formName === 'profile') {
    const name = String(data.get('name') || '').trim();
    if (!name) return;
    state.child = { ...state.child, name, age: Number(data.get('age') || 8), theme: String(data.get('theme') || 'Space Explorers'), profileComplete: true };
    await persistState();
    sessionRole = 'parent';
    goTo('parent');
    showToast('Child profile saved. The adventure is ready.');
    return;
  }
  if (formName === 'pin') {
    const pin = String(data.get('pin') || '');
    const status = document.getElementById('pin-status');
    if (!/^\d{4}$/.test(pin)) { status.textContent = 'Please enter exactly 4 numbers.'; return; }
    if (pinMode === 'setup') {
      const confirmPin = String(data.get('confirmPin') || '');
      if (pin !== confirmPin) { status.textContent = 'Those PINs do not match yet.'; return; }
      try { state.parentPinHash = await createPinRecord(pin); } catch (error) { status.textContent = error.message; return; }
      saveState(state);
      sessionRole = 'parent';
      goTo('profile-setup');
      showToast('Family PIN saved. Now create the child profile.');
    } else if (await verifyPinRecord(pin, state.parentPinHash)) {
      sessionRole = 'parent';
      goTo(state.child.profileComplete ? 'parent' : 'profile-setup');
      showToast('Parent space unlocked.');
    } else {
      status.textContent = 'That PIN does not match. Try again.';
    }
  }
};

const completeMissionForReal = async () => {
  if (!modal) return;
  const mission = getMission(modal.missionId);
  if (!requireAuthenticatedFamily()) { modal.message = 'A grown-up must sign in and set up this family before a mission can be saved.'; render(); return; }
  if (modal.checkedSteps.length !== mission.steps.length) { modal.message = 'Check off each real-world step before completing the mission.'; render(); return; }
  if (!modal.photoData || !modal.photoFile) { modal.message = 'Add a JPEG, PNG, or WebP photo of what you made before completing this mission.'; render(); return; }
  try {
    modal.message = 'Saving your mission safely…'; render();
    const photoPath = (await familyApi.uploadMissionPhoto(authUser.id, mission.id, modal.photoFile)).path;
    const now = new Date().toISOString();
    const submission = { photoData: modal.photoData, photoPath, note: modal.note, completedAt: now, title: mission.title, rewardLabel: missionReward(mission), rewardStatus: 'pending', rewardApprovedAt: null };
    state.completedMissionIds = [...new Set([...state.completedMissionIds, mission.id])].sort((a, b) => getMission(a).order - getMission(b).order);
    state.submissions[mission.id] = submission; state.lastActivityAt = now;
    const progress = getLevelProgress(MISSIONS, state, mission.level); if (progress.isComplete) state.levelRewards[mission.level] = { unlockedAt: now, reward: getLevel(mission.level).reward };
    await Promise.all([familyApi.saveMissionSubmission(authUser.id, { missionId: mission.id, ...submission }), persistState({ strict: true })]);
    modal = null; render(); showToast(`Mission complete! ${missionReward(mission)} is waiting for approval.`);
  } catch (error) { console.error('Mission save failed', error); modal.message = 'Your mission could not be saved yet. Check your connection and try again.'; render(); }
};
app.addEventListener('submit', (event) => { const form = event.target.closest('form[data-form]'); if (!form) return; event.preventDefault(); handleSubmitSafe(form, event.submitter?.dataset.authMode || form.dataset.submitterMode || 'signin'); });
app.addEventListener('input', (event) => { if (event.target.matches('[data-action="mission-note"]') && modal) modal.note = event.target.value; });
app.addEventListener('change', (event) => { if (!event.target.matches('[data-action="photo-change"]') || !modal) return; const file = event.target.files?.[0]; if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { event.stopImmediatePropagation(); modal.photoFile = null; modal.photoData = ''; modal.message = 'Use a JPEG, PNG, or WebP photo smaller than 10 MB.'; render(); } }, true);
app.addEventListener('change', async (event) => { if (event.target.matches('[data-action="toggle-step"]') && modal) { const index = Number(event.target.dataset.stepIndex); modal.checkedSteps = event.target.checked ? [...new Set([...modal.checkedSteps, index])] : modal.checkedSteps.filter((item) => item !== index); render(); } if (event.target.matches('[data-action="photo-change"]') && modal && event.target.files?.[0]) { modal.photoFile = event.target.files[0]; modal.photoData = await readFile(event.target.files[0]); modal.message = ''; render(); } });
app.addEventListener('click', async (event) => { const target = event.target.closest('[data-action]'); if (!target) return; const action = target.dataset.action; if (action === 'reset-password') { const email = String(document.getElementById('parent-email')?.value || state.parentEmail || '').trim(); if (!email) { authError = 'Enter your parent email first.'; render(); return; } try { await authApi.sendPasswordReset(email); authError = 'Password reset email sent. Check your inbox.'; render(); } catch (error) { authError = authMessage(error); render(); } } else if (action === 'approve-reward' || action === 'reset-progress') { if (supabaseEnabled && authUser) await persistState(); } else if (action === 'sign-out' && supabaseEnabled) { try { await authApi.signOut(); } catch (error) { console.error('Supabase sign out failed', error); } authUser = null; } });

app.addEventListener('click', async (event) => {
  const authButton = event.target.closest('button[data-auth-mode]');
  if (authButton?.form) {
    authButton.form.dataset.submitterMode = authButton.dataset.authMode;
    return;
  }
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  // Let native form controls keep their browser behavior. The change handler
  // below owns the checklist state after the checkbox has toggled.
  if (action === 'toggle-step') return;
  event.preventDefault();

  if (action === 'show-roles') { if (!authUser) { route = 'login'; authError = 'A grown-up must sign in before opening child access.'; return render(); } return goTo('roles'); }
  if (action === 'back-login') return goTo('login');
  if (action === 'back-roles') return goTo('roles');
  if (action === 'parent-role') {
    if (!authUser || hydratedOwnerId !== authUser.id) { route = 'login'; authError = 'Your family space is still loading. Please wait a moment.'; return render(); }
    pinMode = state.parentPinHash ? 'verify' : 'setup';
    return goTo('pin');
  }
  if (action === 'child-role') {
    if (!requireAuthenticatedFamily()) { route = 'login'; authError = 'A grown-up needs to sign in and finish the child profile first.'; return render(); }
    sessionRole = 'child';
    return goTo(childRoute());
  }
  if (action === 'child-nav') {
    route = target.dataset.view || 'child-home';
    modal = null;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (action === 'open-mission') return openMission(target.dataset.missionId);
  if (action === 'skip-mission') {
    modal = null;
    render();
    return showToast('No rush. Your mission is waiting when you are ready.');
  }
  if (action === 'close-modal') { modal = null; return render(); }
  if (action === 'complete-mission') return completeMissionForReal();
  if (action === 'parent-from-child') {
    pinMode = state.parentPinHash ? 'verify' : 'setup';
    return goTo('pin');
  }
  if (action === 'switch-child') {
    if (!requireAuthenticatedFamily()) return goTo('login');
    sessionRole = 'child';
    return goTo('child-home');
  }
  if (action === 'edit-profile') {
    sessionRole = 'parent';
    return goTo('profile-setup');
  }
  if (action === 'open-reward-planner') return goTo('reward-planner');
  if (action === 'back-parent') return goTo('parent');
  if (action === 'save-mission-reward') {
    const mission = getMission(target.dataset.missionId); const input = document.getElementById(`mission-reward-${mission?.id}`); const reward = String(input?.value || '').trim();
    if (!mission || !reward) return showToast('Add a reward before saving.');
    state.missionRewardOverrides[mission.id] = reward;
    const submission = state.submissions[mission.id]; if (submission) { submission.rewardLabel = reward; await familyApi.saveMissionSubmission(authUser.id, { missionId: mission.id, ...submission }); }
    await persistState({ strict: true }); render(); return showToast('Mission reward saved.');
  }
  if (action === 'approve-mission-reward') {
    const mission = getMission(target.dataset.missionId); if (!mission || !state.submissions[mission.id]) return;
    const approvedAt = new Date().toISOString(); state.missionRewardApprovals[mission.id] = { approvedAt }; state.submissions[mission.id].rewardStatus = 'approved'; state.submissions[mission.id].rewardApprovedAt = approvedAt;
    await Promise.all([familyApi.saveMissionSubmission(authUser.id, { missionId: mission.id, ...state.submissions[mission.id] }), persistState({ strict: true })]); render(); return showToast('Reward approved for real life.');
  }
  if (action === 'approve-reward') {
    const level = target.dataset.level;
    if (!level) return;
    state.approvedRewards[level] = { approvedAt: new Date().toISOString() };
    await persistState();
    render();
    return showToast('Reward approved for real life.');
  }
  if (action === 'reset-progress') {
    if (!window.confirm('Reset all mission progress for this child?')) return;
    Object.assign(state, clearProgress(state));
    await persistState();
    render();
    return showToast('Mission progress reset. The trail is ready again.');
  }
  if (action === 'sign-out') {
    authUser = null;
    sessionRole = null;
    authError = '';
    return goTo('login');
  }
  if (action === 'brand-home') {
    return goTo(sessionRole === 'child' ? 'child-home' : sessionRole === 'parent' ? 'parent' : 'login');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal) { modal = null; render(); }
});

startAuthObserver();
render();

