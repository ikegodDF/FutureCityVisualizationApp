export const UI_MODES = {
  EDITOR: 'editor',
  GENERAL: 'general',
};

const normalizeMode = (rawMode) => {
  const mode = String(rawMode || '').toLowerCase();
  return Object.values(UI_MODES).includes(mode) ? mode : UI_MODES.EDITOR;
};

export const getUIMode = () => normalizeMode(import.meta.env.VITE_UI_MODE);
