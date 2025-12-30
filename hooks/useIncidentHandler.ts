import { useState, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import Constants from 'expo-constants'; // <--- Importante
import { Logger } from '../utils/logger';

export const useIncidentHandler = () => {
  const [isIncidentDetected, setIsIncidentDetected] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const ws = useRef<WebSocket | null>(null);

  // --- LOGICA IP DINAMICO ---
  const getServerUrl = () => {
    // In Dev Build, hostUri contiene "IP_DEL_PC:PORTA_METRO" (es. 192.168.1.5:8081)
    const debuggerHost = Constants.expoConfig?.hostUri; 
    
    if (debuggerHost) {
        // Prendiamo solo l'IP togliendo la porta
        const ip = debuggerHost.split(':')[0]; 
        return `ws://${ip}:8082`; // Usiamo la porta del nostro server.js
    }
    
    // Fallback per casi estremi (es. simulatore iOS a volte usa localhost)
    return 'ws://192.168.0.67:8082';
  };

  // --- LOGICA AUDIO (Invariata) ---
  const playEmergencySound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/1000.wav')
      );
      soundRef.current = sound;
      await sound.setVolumeAsync(1.0);

      const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

      // Play only the first `beepMs` milliseconds of the file (trim at playback)
      // Determine the actual duration of the audio file and play it fully
      const status = await sound.getStatusAsync();
      const fileDuration = (status && status.durationMillis) ? status.durationMillis : 250;

      const playOnceFull = async () => {
        try { await sound.stopAsync(); } catch {}
        await sound.setPositionAsync(0);
        await sound.playAsync();
        // wait the full file duration so we don't trim the audio
        await delay(Math.ceil(fileDuration));
      };

      // Emergency pattern: 3 full beeps (fileDuration each), short gap, repeat twice
      for (let round = 0; round < 2; round++) {
        for (let i = 0; i < 2; i++) {
          await playOnceFull();
          // short gap between beeps
          await delay(150);
        }
        // longer pause between rounds
        await delay(600);
      }

    } catch (e) {
      console.log(e);
    }
  };

  const triggerManualIncident = () => {
    if (!isIncidentDetected) {
      setIsIncidentDetected(true);
      Logger.debug('WS command received. Triggering incident.');
      playEmergencySound();
    }
  };

  const resetIncident = () => {
    setIsIncidentDetected(false);
    Logger.success('Sistema Resettato');
    if (soundRef.current) soundRef.current.unloadAsync();
  };

  // --- CONNESSIONE WEBSOCKET ---
  useEffect(() => {
    const wsUrl = getServerUrl();
    Logger.debug(`Attempting to connect to ${wsUrl}. Please disable this in production.`);

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      Logger.debug('WS connection established.');
    };

    ws.current.onmessage = (e) => {
      const command = e.data;
      if (command === 'crash') triggerManualIncident();
      if (command === 'reset') resetIncident();
    };

    ws.current.onerror = (e: any) => {
      Logger.debug(`Unable to connect to WS: ${e.message}`);
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  return {
    isIncidentDetected,
    triggerManualIncident,
    resetIncident
  };
};