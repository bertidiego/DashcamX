import { FFmpegKitConfig } from 'ffmpeg-kit-react-native';
import * as FileSystem from 'expo-file-system/legacy'; // O 'expo-file-system' se non sei su SDK 52+
import { Asset } from 'expo-asset';
import { Logger } from './logger';

export const setupFFmpegFonts = async () => {
  try {
    // 1. Definiamo una cartella dedicata ai font
    const fontDirectory = `${FileSystem.documentDirectory}ffmpeg_fonts/`;
    const fontName = "overlay.ttf"; // Nome fisico del file
    const destinationUri = fontDirectory + fontName;

    // 2. Assicuriamoci che la cartella esista
    const dirInfo = await FileSystem.getInfoAsync(fontDirectory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(fontDirectory, { intermediates: true });
    }

    // 3. Copiamo il font dagli Assets alla cartella (se non c'è già)
    const fileInfo = await FileSystem.getInfoAsync(destinationUri);
    
    if (!fileInfo.exists) {
        const fontModule = require('../assets/fonts/overlay.ttf'); // IL TUO FONT QUI
        const fontAsset = Asset.fromModule(fontModule);
        await fontAsset.downloadAsync();
        
        await FileSystem.copyAsync({
            from: fontAsset.localUri || fontAsset.uri,
            to: destinationUri
        });
        Logger.debug("Font copiato fisicamente in: " + destinationUri);
    }

    // 4. LA MAGIA: Registriamo la directory in FFmpegKit
    // Il secondo parametro è un mapping opzionale: {"NomeLogico": "NomeFile"}
    // Questo ci permette di usare font='MyCustomFont' nel comando!
    const mapping = {
        "MyDashCamFont": fontName 
    };

    // Percorso pulito per Android (senza file://)
    const cleanFontDir = fontDirectory.replace('file://', '');

    await FFmpegKitConfig.setFontDirectory(cleanFontDir, mapping);
    
    Logger.success("FFmpeg Font Directory configurata!");

  } catch (e) {
    Logger.error("Errore configurazione Font FFmpeg", e);
  }
};