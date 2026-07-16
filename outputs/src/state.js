const STORAGE_KEY = 'orbit-oak-app-v1';

export const createDefaultState = () => ({
  version: 1,
  parentEmail: '',
  parentPinHash: '',
  child: { name: '', age: 8, theme: 'Space Explorers', profileComplete: false },
  completedMissionIds: [],
  submissions: {},
  levelRewards: {},
  approvedRewards: {},
  lastActivityAt: null
});

export const loadState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || saved.version !== 1) return createDefaultState();
    return { ...createDefaultState(), ...saved, child: { ...createDefaultState().child, ...(saved.child || {}) } };
  } catch {
    return createDefaultState();
  }
};

export const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearProgress = (state) => ({
  ...state,
  completedMissionIds: [],
  submissions: {},
  levelRewards: {},
  approvedRewards: {},
  lastActivityAt: null
});

export const hasCompleted = (state, missionId) => state.completedMissionIds.includes(missionId);

export const completionCount = (state) => state.completedMissionIds.length;

export const currentMissionId = (missions, state) => missions.find((mission) => !hasCompleted(state, mission.id))?.id || null;

export const getLevelProgress = (missions, state, levelId) => {
  const levelMissions = missions.filter((mission) => mission.level === levelId);
  const complete = levelMissions.filter((mission) => hasCompleted(state, mission.id)).length;
  return { complete, total: levelMissions.length, isComplete: complete === levelMissions.length };
};

export const isMissionOpen = (missions, state, mission) => {
  if (hasCompleted(state, mission.id)) return true;
  const current = currentMissionId(missions, state);
  return current === mission.id;
};

export const totalXp = (missions, state, levels) => state.completedMissionIds.reduce((sum, id) => {
  const mission = missions.find((item) => item.id === id);
  const level = levels.find((item) => item.id === mission?.level);
  return sum + (level?.xp || 0);
}, 0);

export const levelRewardKey = (levelId) => `${levelId}-reward`;
