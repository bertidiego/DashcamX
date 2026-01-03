import { Camera, useCameraDevices, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import { StyleSheet, Text, View, NativeModules, Platform } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as MediaLibrary from 'expo-media-library';

// --- FIX PER EXPO SDK 52+ / 54 ---
// Usiamo l'import legacy per mantenere la compatibilità con copyAsync e cacheDirectory
import * as FileSystem from 'expo-file-system/legacy'; 

import { Asset } from 'expo-asset';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';

import { BottomOverlay } from './components/BottomOverlay';
import { SettingsMenu, SettingsItem } from './components/SettingsMenu';
import { Alert as TopAlert, AlertType } from './components/Alert';

import { useIncidentHandler } from './hooks/useIncidentHandler';
import { Logger } from './utils/logger';

import './global.css';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};

const STORAGE_KEY = 'onedrive_auth_token';

async function changeScreenOrientation() {
  await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
}

export default function App() {
  const [now, setNow] = useState(new Date());

  const [showOneDrive, setShowOneDrive] = useState(false);
  const [oneDriveConnected, setOneDriveConnected] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const camera = useRef<Camera>(null)
  const [cameraReady, setCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const micHook: any = useMicrophonePermission();
  const [topAlert, setTopAlert] = useState<{
    type: AlertType;
    title?: string;
    text: string;
    durationMs?: number;
  } | null>(null);

  const devices = useCameraDevices();

  // Force-selection: set this to the 1-based camera number you want to use (e.g. 2 => second camera)
  const FORCE_CAMERA_NUMBER = 2;

  useEffect(() => {
    Logger.camera('Available camera devices:', devices);
  }, [devices]);

  useEffect(() => {
    logFfmpegAvailability();
  }, []);

  function logFfmpegAvailability() {
    try {
      Logger.camera('Platform:', Platform.OS);
      Logger.camera('FFmpegKit import present:', !!FFmpegKit);
    } catch (e) {
      Logger.error('Failed to log FFmpeg availability', e);
    }
  }

  useEffect(() => {
    Logger.camera('Device list for selection:', Object.values(devices as any).filter(Boolean).map((d: any) => ({ id: d.id ?? d.deviceId ?? d.name, name: d.name ?? d.label ?? d.deviceId, position: d.position })));
  }, [devices]);

  const available = Object.values(devices as any).filter(Boolean);
  let device: any = null;
  if (available.length > 0) {
    const list = available;
    const keywords = ['wide', 'wide-angle', 'ultra', 'ultrawide', 'main'];
    let preferredIndex = list.findIndex((d: any) => {
      const name = (d.name || d.label || '').toLowerCase();
      return keywords.some((k) => name.includes(k));
    });
    if (preferredIndex === -1) preferredIndex = list.findIndex((d: any) => d.position === 'back' || d.position === 'rear');
    if (preferredIndex === -1) preferredIndex = 0;

    if (FORCE_CAMERA_NUMBER && list.length >= FORCE_CAMERA_NUMBER) {
      const forcedIdx = Math.max(0, FORCE_CAMERA_NUMBER);
      device = list[forcedIdx] ?? list[0];
    } else {
      device = list[preferredIndex] ?? list[0];
    }
  }

  const startManualRecording = async () => {
    if (!camera.current || !cameraReady) {
      setTopAlert({ type: 'error', text: 'Fotocamera non pronta. Riprova.' });
      return;
    }

    try {
      if (micHook) {
        const req = micHook.request || micHook.requestPermission || micHook.requestMicrophonePermission;
        if (req) await req();
      }
    } catch (e) {
      Logger.error('Microphone permission request failed', e);
    }

    setIsRecording(true);
    setTopAlert({ type: 'info', text: 'Recording...', durationMs: 0 });

    try {
      await camera.current.startRecording({
        flash: 'off',
        fileType: 'mp4',
        quality: 'high',
        onRecordingFinished: async (video: any) => {
          const uri = video?.path ?? video?.uri ?? video?.filePath ?? null;
          Logger.camera('Recording finished:', uri);
          setRecordedUri(uri);
          
          try {
            // Processing con FFmpeg
            const processed = await processVideoWithFFmpeg(uri);
            const toSave = processed ?? uri;
            const saved = await saveVideoToGallery(toSave as string);
            
            if (saved) {
              setTopAlert({ type: 'success', text: 'Video salvato in Galleria!', durationMs: 3000 });
            } else {
              setTopAlert({ type: 'error', text: 'Salvato ma non in Galleria', durationMs: 4000 });
            }
          } catch (e) {
            Logger.error('Failed to save recording to gallery', e);
            setTopAlert({ type: 'error', text: 'Impossibile salvare il video', durationMs: 4000 });
          }
          setIsRecording(false);
        },
        onRecordingError: (error: any) => {
          Logger.error('Recording error', error);
          setTopAlert({ type: 'error', text: 'Recording failed', durationMs: 4000 });
          setIsRecording(false);
        },
      } as any);
    } catch (err) {
      Logger.error('startRecording threw', err);
      setTopAlert({ type: 'error', text: 'Failed to start recording', durationMs: 4000 });
      setIsRecording(false);
    }
  };

  async function saveVideoToGallery(uri: string | null) {
    if (!uri) return false;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return false;

      const asset = await MediaLibrary.createAssetAsync(uri.startsWith('file://') ? uri : `file://${uri}`);
      const albumName = 'DashcamX';
      
      try {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      } catch (e: any) {
        const albums = await MediaLibrary.getAlbumsAsync();
        const exists = albums.find((a) => a.title === albumName);
        if (exists) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], exists.id, false);
        }
      }
      return true;
    } catch (err) {
      Logger.error('saveVideoToGallery error', err);
      return false;
    }
  }

  // --- FUNZIONE FFMPEG AGGIORNATA ---
async function processVideoWithFFmpeg(inputUri: string | null) {
    if (!inputUri) return null;

    try {
      if (!FFmpegKit) {
        Logger.error('FFmpegKit native module not found');
        return null;
      }

      // 1. Setup Percorsi
      const input = inputUri.startsWith('file://') ? inputUri : `file://${inputUri}`;
      const outName = `processed_${Date.now()}.mp4`;
      
      // Usiamo documentDirectory invece di cacheDirectory (è più persistente)
      const outputUri = `${FileSystem.documentDirectory}${outName}`;
      const cleanOutputPath = outputUri.replace('file://', '');

      Logger.camera('FFmpeg Input:', input);

      // 2. STRATEGIA FONT (Custom -> System -> Null)
      let fontPathForFFmpeg = null;
      
      try {
        // TENTATIVO A: Font Custom dagli Assets
        const fontModule = require('./assets/fonts/overlay.ttf');
        const fontAsset = Asset.fromModule(fontModule);
        await fontAsset.downloadAsync();

        const fontUri = `${FileSystem.documentDirectory}font_overlay.ttf`;
        
        // Cancelliamo se esiste già per evitare file corrotti vecchi
        await FileSystem.deleteAsync(fontUri, { idempotent: true });

        await FileSystem.copyAsync({
          from: fontAsset.localUri || fontAsset.uri,
          to: fontUri
        });

        // Verifica esistenza e dimensione
        const check = await FileSystem.getInfoAsync(fontUri);
        if (check.exists && check.size > 0) {
          fontPathForFFmpeg = fontUri.replace('file://', '');
          Logger.camera('Font Custom OK:', fontPathForFFmpeg);
        } else {
          throw new Error('Font custom vuoto o non copiato');
        }

      } catch (fontErr) {
        Logger.warn('Font Custom fallito, provo fallback di sistema...', fontErr);
        
        // TENTATIVO B: Font di Sistema Android (Roboto)
        const systemFont = '/system/fonts/Roboto-Regular.ttf';
        const checkSys = await FileSystem.getInfoAsync(`file://${systemFont}`);
        if (checkSys.exists) {
            fontPathForFFmpeg = systemFont;
            Logger.camera('Font Sistema OK:', fontPathForFFmpeg);
        } else {
            Logger.debug('Nessun font trovato. Il video sarà salvato senza overlay.');
        }
      }

      // 3. COSTRUZIONE COMANDO
      const targetBitrate = '8M'; // alza la qualità
      const baseRotateFilter = 'transpose=1'; // 90° in senso orario

      let cmd;

            if (fontPathForFFmpeg) {
        // Usa davvero il font trovato
        const safeFontPath = fontPathForFFmpeg;

        // Testo centrato orizzontalmente e appoggiato in basso sul lato lungo
        const drawtextFilter =
          `drawtext=fontfile='${safeFontPath}':` +
          `text='DashcamX running!':` +
          `fontcolor=white:` +
          `fontsize=48:` +
          `x=(w-text_w)/2:` +        // centro orizzontale (sul lato lungo)
          `y=h-line_h-40`;           // bordo basso, con un piccolo margine

        // 1) ruota il video, 2) scrive il testo sul frame già orizzontale
        const filters = `${baseRotateFilter},${drawtextFilter}`;

        cmd = `-y -i "${input}" -vf "${filters}" -c:v libx264 -b:v ${targetBitrate} -preset veryfast -profile:v high -level 4.1 -c:a copy "${cleanOutputPath}"`;
      }

      Logger.camera('FFmpeg Command:', cmd);
      
      const session = await FFmpegKit.execute(cmd);
      const returnCode = await session.getReturnCode();

      if (ReturnCode.isSuccess(returnCode)) {
        Logger.camera('FFmpeg Success! Output:', cleanOutputPath);
        return `file://${cleanOutputPath}`;
      } else {
        const logs = await session.getAllLogsAsString();
        Logger.error('FFmpeg Failed. Logs:', logs);
        
        // Se fallisce l'overlay, proviamo a salvare almeno il video originale
        setTopAlert({ type: 'warning', text: 'Overlay fallito, salvo video originale' });
        return inputUri; 
      }

    } catch (err) {
      Logger.error('processVideoWithFFmpeg Exception', err);
      // In caso di crash totale della funzione, ritorna l'originale
      return inputUri;
    }
  }
  const stopManualRecording = () => {
    try {
      camera.current?.stopRecording();
    } catch (e) {
      Logger.error('stopRecording error', e);
      setTopAlert({ type: 'error', text: 'Failed to stop recording', durationMs: 3000 });
      setIsRecording(false);
    }
  };

  const { hasPermission, requestPermission } = useCameraPermission();
  const { isIncidentDetected, resetIncident } = useIncidentHandler();

  const redirectUri = makeRedirectUri({ scheme: 'dashcamx', path: 'auth' });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: '4dea25a0-2318-46d0-b27a-0fa585a485fe',
      scopes: ['openid', 'profile', 'email', 'Files.Read', 'User.Read'],
      redirectUri,
      responseType: ResponseType.Code,
    },
    discovery
  );

  useEffect(() => {
    changeScreenOrientation();
    if (!hasPermission) requestPermission();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function checkSession() {
      const savedToken = await SecureStore.getItemAsync(STORAGE_KEY);
      if (savedToken) {
        setToken(savedToken);
        setOneDriveConnected(true);
      }
    }
    checkSession();
  }, []);

  useEffect(() => {
    if (response) Logger.auth('OneDrive auth response:', response);

    if (response?.type === 'success') {
      const { access_token } = response.params;
      setToken(access_token);
      setOneDriveConnected(true);
      SecureStore.setItemAsync(STORAGE_KEY, access_token);
      setShowOneDrive(false);
      Logger.success('Successfully established a connection with OneDrive');

      setTopAlert({
        type: 'success',
        title: 'OneDrive',
        text: 'Connected successfully',
        durationMs: 3000,
      });

    } else if (response?.type === 'error') {
      Logger.error('Authentication error -', response);
      setTopAlert({
        type: 'error',
        title: 'OneDrive Error',
        text: 'Authentication failed',
        durationMs: 4000,
      });
      setShowOneDrive(false);
    } else if (response?.type === 'dismiss') {
      Logger.auth('Authentication aborted by the user');
      setShowOneDrive(false);
    }
  }, [response]);

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setToken(null);
    setOneDriveConnected(false);
    setTopAlert({ type: 'info', text: 'Disconnected from OneDrive', durationMs: 2000 });
  };

  const overlayItems = [{ label: 'Time', value: now.toLocaleTimeString() }];

  const oneDriveItems: SettingsItem[] = [
    {
      key: 'onedrive-status',
      label: 'OneDrive',
      description: 'Connection status',
      status: oneDriveConnected ? 'connected' : 'not-connected',
      statusLabel: oneDriveConnected ? 'Connected' : 'Not connected',
    },
    {
      key: 'connect-onedrive-action',
      label: oneDriveConnected ? 'Disconnect Account' : 'Set-up your OneDrive Account',
      description: oneDriveConnected ? 'Sign out from OneDrive' : 'Sign in to your OneDrive account',
      onPress: () => {
        if (oneDriveConnected) {
          handleLogout();
        } else {
          promptAsync();
        }
      },
    },
  ];

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera.</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No camera device found. Enable emulator camera or run on a physical device. See logs for available devices.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        video={true}
        audio={true}
        onInitialized={() => {
          Logger.camera('Camera initialized');
          setCameraReady(true);
        }}
        onError={(e) => {
          Logger.camera('Camera error', e);
          setTopAlert({ type: 'error', text: `Errore fotocamera: ${((e as any)?.message) ?? 'unknown'}` });
          setCameraReady(false);
        }}
      />

      {!isIncidentDetected && topAlert && (
        <TopAlert
          type={topAlert.type}
          title={topAlert.title}
          text={topAlert.text}
          durationMs={topAlert.durationMs}
          onClose={() => setTopAlert(null)}
        />
      )}

      {isIncidentDetected && (
        <View style={styles.emergencyOverlay}>
          <TopAlert
            type="warning"
            title="Crash Detected!"
            text="An emergency incident has been detected. Please take necessary actions."
            durationMs={10000}
            interactive={true}
            closeable={true}
            icon={'car-crash'}
            iconPack={'fa5'}
            onClose={() => {
              resetIncident();
            }}
          />
        </View>
      )}

      {!isIncidentDetected && (
        <>
          {showOneDrive && (
            <SettingsMenu title="Cloud Settings" items={oneDriveItems} onClose={() => setShowOneDrive(false)} />
          )}

          <BottomOverlay
            items={overlayItems}
            cloudStatus={oneDriveConnected ? 'ok' : 'error'}
            syncing={false}
            onCloudLongPress={() => setShowOneDrive(true)}
            onManualRecPress={() => {
              if (!isRecording) startManualRecording();
              else stopManualRecording();
            }}
          />
        </>
      )}

      <View style={styles.buttonContainer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'black',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 64,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    width: '100%',
    paddingHorizontal: 64,
  },
  emergencyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  emergencyTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  emergencySubtitle: {
    fontSize: 18,
    color: 'white',
    marginBottom: 40,
    opacity: 0.9,
  },
  resetButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    backgroundColor: 'white',
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  resetButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  deviceButtonWrapper: {
    position: 'absolute',
    top: 24,
    right: 16,
    zIndex: 99999,
  },
  deviceButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  deviceButtonText: {
    color: 'white',
    fontSize: 12,
  },
});