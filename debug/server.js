// debug/server.js
const WebSocket = require('ws');
const readline = require('readline');

// --- MINI LOGGER PER IL SERVER (Così non devi importare nulla) ---
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

const Log = {
  auth: (msg) => {
    // Il \n all'inizio stacca la scritta LOG dal tuo tag
    console.log(`${COLORS.fg.magenta}${COLORS.bold}[AUTH] ${msg}${COLORS.reset}`);
  },

  camera: (msg) => {
    console.log(`${COLORS.fg.blue}${COLORS.bold}[CAMERA] ${msg}${COLORS.reset}`);
  },

  success: (msg) => {
    console.log(`${COLORS.fg.green}${COLORS.bold}✔ ${msg}${COLORS.reset}`);
  },

  error: (msg) => {
    // Per gli errori usiamo console.error che aggiunge ERROR, ma noi lo coloriamo
    console.error(`${COLORS.fg.red}${COLORS.bold}✖ ${msg}${COLORS.reset}`);
  },
  
  // Un log "debug" che usa un colore meno invadente
  debug: (msg) => {
    console.log(`${COLORS.fg.cyan}${COLORS.bold}[DEBUG] ${msg}${COLORS.reset}`);
  }
};

// --- CONFIGURAZIONE SERVER ---
const PORT = 8082;
const wss = new WebSocket.Server({ port: PORT });

console.clear();
Log.debug(`DashcamX WS running on port ${PORT}`);
Log.debug(`Please disable the ws in production builds!\n\n`);


// --- GESTIONE CONNESSIONI ---
wss.on('connection', ws => {
  Log.success('Connected to DashcamX');
  Log.debug('Please enter a command to inject in the app.\n');
  
  ws.on('close', () => Log.error('App disconnected from server'));

  
  ws.on('error', (e) => Log.error(`Socket error - ${e.message}`));
});

// --- LETTURA TASTIERA ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
  const command = input.trim();
  
  if (!command) return;

  // Invia a tutti i client connessi
  let sentCount = 0;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(command);
      sentCount++;
    }
  });

  if (sentCount > 0) {
    Log.debug(command);
  } else {
    Log.debug("DashcamX app is not connected. Start the app to receive commands.");
  }
});