// src/utils/Logger.ts

const COLORS = {
  reset: "\x1b[0m",
  fg: {
    magenta: "\x1b[35m",
    blue: "\x1b[34m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
  },
  // Grassetto
  bold: "\x1b[1m",
};

export const Logger = {
  auth: (msg: string, data?: any) => {
    // Il \n all'inizio stacca la scritta LOG dal tuo tag
    console.log(`${COLORS.fg.magenta}${COLORS.bold}[AUTH] ${msg}${COLORS.reset}`, data ? data : '');
  },

  camera: (msg: string, data?: any) => {
    console.log(`${COLORS.fg.blue}${COLORS.bold}[CAMERA] ${msg}${COLORS.reset}`, data ? data : '');
  },

  success: (msg: string) => {
    console.log(`${COLORS.fg.green}${COLORS.bold}✔ ${msg}${COLORS.reset}`);
  },

  error: (msg: string, error?: any) => {
    // Per gli errori usiamo console.error che aggiunge ERROR, ma noi lo coloriamo
    console.error(`${COLORS.fg.red}${COLORS.bold}✖ ${msg}${COLORS.reset}`, error ? error : '');
  },
  
  // Un log "debug" che usa un colore meno invadente
  debug: (msg: string, data?: any) => {
    console.log(`${COLORS.fg.cyan}${COLORS.bold}[DEBUG] ${msg}${COLORS.reset}`, data ? data : '');
  }
};