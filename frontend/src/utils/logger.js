const DEBUG_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEBUG_LOGS === 'true';

export const logger = {
  debug: (...args) => {
    if (DEBUG_ENABLED) console.debug(...args);
  },
  info: (...args) => {
    if (DEBUG_ENABLED) console.info(...args);
  },
  warn: (...args) => {
    if (DEBUG_ENABLED) console.warn(...args);
  },
  error: (...args) => {
    if (DEBUG_ENABLED) console.error(...args);
  },
};
