Exit code: 0
Wall time: 2.1 seconds
Output:
import { BADGES, LEVELS, MISSIONS, getLevel, getMission } from './data/missions.js';
import { clearProgress, completionCount, currentMissionId, getLevelProgress, hasCompleted, isMissionOpen, loadState, saveState, totalXp } from './state.js';
import { authApi, authMessage, familyApi, supabaseEnabled } from './integrations/supabase-service.js?version=7';

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

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const formatDate = (date) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(date));
const currentMission = () => { const id = currentMissionId(MISSIONS, state); return id ? getMission(id) : null; };
const currentLevel = () => currentMission()?.level || 'expert';
const childName = () => state.child.name || 'Explorer';
const earnedLevelBadge = (levelId) => Boolean(state.levelRewards[levelId]);
const showToast = (message) => { toast.textContent = message; toast.classList.add('show'); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3000); };
const goTo = (nextRoute) => { modal = null; authError = ''; route = nextRoute; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
const childRoute = () => state.child.profileComplete ? 'child-home' : 'child-home';

const persistState = async () => {
  saveState(state);
  if (!supabaseEnabled || !authUser) return;
  try {
    await familyApi.save(authUser.id, state);
  } catch (error) {
    showToast('Saved on this device. Cloud sync needs attention.');
    console.error('Supabase sync failed', error);
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
    }
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

const hashPin = async (pin) => {
  if (globalThis.crypto?.subtle) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
    return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return btoa(pin.split('').reverse().join(''));
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

const renderMissionPath = () => `<div class="climb-path" aria-label="49 mission climb path">${LEVELS.map((level) => { const progress = getLevelProgress(MISSIONS, state, level.id); return `<section class="path-level ${level.color}" aria-labelledby="path-${level.id}"><div class="path-level-heading"><div class="path-level-icon">${level.icon}</div><div><p class="eyebrow">${level.name} level</p><h2 id="path-${level.id}">${level.range}</h2></div><div class="path-level-reward"><strong>${progress.complete}/${progress.total}</strong><span>${progress.isComplete ? 'Reward unlocked' : `${level.xp} XP each`}</span></div></div><div class="path-stops">${MISSIONS.filter((mission) => mission.level === level.id).map((mission, index) => { const done = hasCompleted(state, mission.id); const open = isMissionOpen(MISSIONS, state, mission); return `<div class="path-stop ${index % 2 ? 'right' : 'left'} ${done ? 'done' : ''} ${open && !done ? 'current' : ''}"><button class="path-node" type="button" data-action="open-mission" data-mission-id="${mission.id}" ${open ? '' : 'disabled'} aria-label="Mission ${mission.order}: ${escapeHtml(mission.title)}${done ? ', complete' : open ? ', current mission' : ', locked'}"><span>${done ? '✓' : mission.order}</span><strong>${escapeHtml(mission.title)}</strong><small>${open && !done ? 'Climb here' : done ? 'Complete' : 'Locked'}</small></button></div>`; }).join('')}</div><div class="path-reward"><span class="path-reward-icon">🎁</span><div><strong>${progress.isComplete ? `${level.badge} earned` : 'Reward at the summit'}</strong><span>${escapeHtml(level.reward)}</span></div></div></section>`; }).join('')}</div>`;

const renderMissions = () => `<section class="screen" aria-labelledby="missions-title"><div class="missions-head"><div><p class="eyebrow">The full adventure</p><h1 id="missions-title">Climb from curious<br />to capable.</h1><p>Each stop is something a child can do in the real world. Finish the trail, unlock the next level, and earn a reward a parent can approve.</p></div><div class="mission-count-big"><strong>${completionCount(state)}</strong> / 49 complete</div></div>${renderMissionPath()}${childNav('missions')}</section>`;

const renderBadges = () => `<section class="screen" aria-labelledby="badges-title"><div class="missions-head"><div><p class="eyebrow">Your collection</p><h1 id="badges-title">Badge shelf.</h1><p>Badges are reminders of what your hands and brain can do.</p></div><div class=…18 tokens truncated…arned' || earnedLevelBadge(badge.level)).length}</strong> earned</div></div><div class="badge-page-grid">${BADGES.map((badge) => { const earned = badge.kind === 'earned' || earnedLevelBadge(badge.level); return `<article class="card badge-page-card ${earned ? '' : 'locked'}"><div class="badge-page-icon">${badge.icon}</div><h3>${badge.name}</h3><p>${badge.description}</p>${earned ? '<span class="badge-status">Earned</span>' : '<span class="badge-status">Locked</span>'}</article>`; }).join('')}</div>${childNav('badges')}</section>`;

const renderRewards = () => LEVELS.map((level) => { const progress = getLevelProgress(MISSIONS, state, level.id); const unlocked = progress.isComplete; const approved = Boolean(state.approvedRewards[level.id]); return `<div class="reward-row ${unlocked ? 'unlocked' : ''}"><div class="reward-icon">${level.icon}</div><div><strong>${level.name} level reward</strong><span>${unlocked ? level.reward : `${progress.complete}/${progress.total} missions complete`}</span></div>${unlocked ? (approved ? '<span class="approved-label">Approved ✓</span>' : `<button class="btn btn-light" type="button" data-action="approve-reward" data-level="${level.id}">Approve</button>`) : '<span class="locked-label">Locked</span>'}</div>`; }).join('');
const renderLevelOverview = () => `<div class="level-overview" aria-label="Level progress">${LEVELS.map((level) => { const progress = getLevelProgress(MISSIONS, state, level.id); return `<div class="level-overview-row"><div class="level-overview-label"><span>${level.icon}</span><strong>${level.name}</strong><small>${progress.complete}/${progress.total}</small></div><div class="level-overview-track"><div style="width: ${Math.round((progress.complete / progress.total) * 100)}%"></div></div></div>`; }).join('')}</div>`;

const renderActivity = () => { const entries = Object.entries(state.submissions).sort(([, a], [, b]) => new Date(b.completedAt) - new Date(a.completedAt)); if (!entries.length) return '<div class="empty-state"><span aria-hidden="true">📝</span><strong>No missions brought back yet.</strong><p>When a child completes a physical mission, the photo and story will appear here.</p></div>'; return `<div class="activity-list">${entries.slice(0, 8).map(([id, item]) => { const mission = getMission(id); const photoUrl = item.photoData || item.photoUrl; return `<div class="activity-item"><div class="activity-thumb">${mission?.icon || '✦'}</div>${photoUrl ? `<img class="activity-photo" src="${photoUrl}" alt="Photo returned for ${escapeHtml(mission?.title || 'mission')}" />` : ''}<div><strong>${escapeHtml(mission?.title || item.title)}</strong><p>${escapeHtml(item.note || mission?.evidence || 'Mission completed and brought back.')}</p></div><time>${formatDate(item.completedAt)}</time></div>`; }).join('')}</div>`; };

const renderParent = () => `<section class="screen" aria-labelledby="parent-title"><div class="parent-header"><div><p class="eyebrow">Grown-up space</p><h1 id="parent-title">${escapeHtml(childName())}’s little<br />adventure log.</h1><p>A quick view of what happened away from the app.</p></div><div class="role-switch"><button class="active" type="button">Parent</button><button type="button" data-action="switch-child">Child view</button></div></div><div class="parent-grid"><article class="card profile-card"><div class="profile-row"><div class="profile-avatar" aria-hidden="true">🧑🏽‍🚀</div><div><h2>${escapeHtml(childName())}, age ${state.child.age}</h2><p>${escapeHtml(state.child.theme)} · cloud-synced child profile</p></div></div><div class="overview-stats"><div class="overview-stat"><strong>${completionCount(state)}</strong><span>missions done</span></div><div class="overview-stat"><strong>4</strong><span>day streak</span></div><div class="overview-stat"><strong>${BADGES.filter((badge) => badge.kind === 'earned' || earnedLevelBadge(badge.level)).length}</strong><span>badges earned</span></div></div>${renderLevelOverview()}<div class="parent-email"><span>Parent account</span><strong>${escapeHtml(state.parentEmail || 'Child-only demo mode')}</strong></div></article><article class="card approval-card"><p class="eyebrow">Real-life rewards</p><h2>Approve a next step</h2><p>Rewards appear when a level is complete. Choose what fits your family today.</p><div class="reward-list">${renderRewards()}</div></article></div><article class="card activity-card"><div class="section-heading"><div><h2>What ${escapeHtml(childName())}’s been up to</h2><p class="muted">Physical work brought back into the story.</p></div><span class="linkish">${Object.keys(state.submissions).length} returned</span></div>${renderActivity()}</article><article class="card settings-card"><div><p class="eyebrow">Family settings</p><h2>Keep the trail yours.</h2><p class="muted">Your child profile, progress, and private mission evidence sync to the signed-in parent account.</p></div><div class="settings-actions"><button class="btn btn-light" type="button" data-action="edit-profile">Edit child profile</button><button class="btn btn-quiet danger-link" type="button" data-action="reset-progress">Reset mission progress</button></div></article></section>`;

const renderModal = () => { if (!modal) return ''; const mission = getMission(modal.missionId); const level = getLevel(mission.level); const completed = hasCompleted(state, mission.id); return `<div class="modal-backdrop open" role="dialog" aria-modal="true" aria-labelledby="mission-dialog-title"><div class="modal mission-modal"><div class="modal-top"><div class="modal-icon">${mission.icon}</div><span class="modal-level">${level.name} · ${level.xp} XP</span></div><h2 id="mission-dialog-title">${escapeHtml(mission.title)}</h2><p>${escapeHtml(mission.hook)}</p><div class="materials-line"><strong>Bring:</strong> ${mission.materials.map(escapeHtml).join(' · ')}</div><div class="mission-progress-summary"><span>${modal.checkedSteps.length}/${mission.steps.length} steps checked</span><span>${modal.photoData ? 'Photo attached' : 'Photo still needed'}</span></div><div class="step-list">${mission.steps.map((step, index) => `<label class="step-item ${modal.checkedSteps.includes(index) ? 'checked' : ''}"><input type="checkbox" data-action="toggle-step" data-step-index="${index}" ${modal.checkedSteps.includes(index) ? 'checked' : ''} ${completed ? 'disabled' : ''} /><span>${escapeHtml(step)}</span></label>`).join('')}</div><div class="evidence-box"><div class="evidence-header"><div><strong>Bring it back</strong><span>${escapeHtml(mission.evidence)}</span></div><span aria-hidden="true">📸</span></div>${modal.photoData ? `<img class="photo-preview" src="${modal.photoData}" alt="Selected mission evidence" />` : ''}${completed ? '' : `<label class="upload-button btn btn-light" for="mission-photo">${modal.photoData ? 'Choose a different photo' : 'Add a photo'}</label><input class="file-hidden" id="mission-photo" data-action="photo-change" type="file" accept="image/*" />`} </div>${completed ? '<p class="completed-note">Mission complete. You can revisit the evidence whenever you like.</p>' : `<label class="form-label" for="mission-note">A sentence about what you noticed (optional)</label><textarea class="form-control mission-note" id="mission-note" data-action="mission-note" rows="2" placeholder="I noticed…">${escapeHtml(modal.note)}</textarea><p class="modal-status" id="modal-status">${escapeHtml(modal.message || '')}</p>`}<div class="modal-actions"><button class="btn btn-quiet" type="button" data-action="close-modal">${completed ? 'Close' : 'Not yet'}</button>${completed ? '' : '<button class="btn btn-primary" type="button" data-action="complete-mission">Complete mission ✦</button>'}</div></div></div>`; };

const render = () => { const views = { login: renderLogin, roles: renderRoles, pin: renderPin, 'profile-setup': renderProfileSetup, 'child-home': renderChildHome, missions: renderMissions, badges: renderBadges, parent: renderParent }; app.innerHTML = `${renderHeader()}<main class="app-main">${views[route]()}</main>${renderModal()}`; };

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
      await persistState();
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
    const pinHash = await hashPin(pin);
    if (pinMode === 'setup') {
      const confirmPin = String(data.get('confirmPin') || '');
      if (pin !== confirmPin) { status.textContent = 'Those PINs do not match yet.'; return; }
      state.parentPinHash = pinHash;
      await persistState();
      sessionRole = 'parent';
      goTo('profile-setup');
      showToast('Family PIN saved. Now create the child profile.');
    } else if (pinHash === state.parentPinHash) {
      sessionRole = 'parent';
      goTo(state.child.profileComplete ? 'parent' : 'profile-setup');
      showToast('Parent space unlocked.');
    } else {
      status.textContent = 'That PIN does not match. Try again.';
    }
  }
};

app.addEventListener('submit', (event) => { const form = event.target.closest('form[data-form]'); if (!form) return; event.preventDefault(); handleSubmitSafe(form, event.submitter?.dataset.authMode || form.dataset.submitterMode || 'signin'); });
app.addEventListener('input', (event) => { if (event.target.matches('[data-action="mission-note"]') && modal) modal.note = event.target.value; });
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
  event.preventDefault();

  if (action === 'show-roles') return goTo('roles');
  if (action === 'back-login') return goTo('login');
  if (action === 'back-roles') return goTo('roles');
  if (action === 'parent-role') {
    pinMode = state.parentPinHash ? 'verify' : 'setup';
    return goTo('pin');
  }
  if (action === 'child-role') {
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
  if (action === 'complete-mission') return completeMission();
  if (action === 'parent-from-child') {
    pinMode = state.parentPinHash ? 'verify' : 'setup';
    return goTo('pin');
  }
  if (action === 'switch-child') {
    sessionRole = 'child';
    return goTo('child-home');
  }
  if (action === 'edit-profile') {
    sessionRole = 'parent';
    return goTo('profile-setup');
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

