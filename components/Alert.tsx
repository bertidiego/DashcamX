import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

export type AlertType = 'success' | 'info' | 'warning' | 'error';

const typeStyles: Record<AlertType, { bg: string; text: string; border: string }> = {
  success: { bg: 'bg-green-600/90', text: 'text-white', border: 'border-green-300/70' },
  info: { bg: 'bg-blue-600/90', text: 'text-white', border: 'border-blue-300/70' },
  warning: { bg: 'bg-amber-600/90', text: 'text-white', border: 'border-amber-300/70' },
  error: { bg: 'bg-red-600/90', text: 'text-white', border: 'border-red-300/70' },
};

const icons: Record<AlertType, keyof typeof MaterialIcons.glyphMap> = {
  success: 'check-circle',
  info: 'info',
  warning: 'warning',
  error: 'error',
};

export function Alert({
  type,
  text,
  title,
  durationMs = 3000,
  onClose,
  interactive = false,
  closeable = false,
  icon,
  iconPack = 'material',
}: {
  type: AlertType;
  text: string;
  title?: string;
  durationMs?: number;
  onClose?: () => void;
  interactive?: boolean; // when true, allow pressing the close button
  closeable?: boolean; // show a close icon inside the alert
  icon?: string; // optional override icon name (string)
  iconPack?: 'material' | 'fa5';
}) {
  const palette = typeStyles[type];
  const iconName = icon ?? icons[type];
  const [progress, setProgress] = useState(0);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const start = Date.now();
    let frame: number;

    const tick = () => {
      const elapsed = Date.now() - start;
      const ratio = Math.min(elapsed / durationMs, 1);
      setProgress(ratio);

      if (ratio < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        onCloseRef.current?.();
      }
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [durationMs, text, title, type]);

  return (
    <View
      className="absolute top-8 left-0 right-0 items-center z-10"
      pointerEvents={interactive ? 'auto' : 'none'}
    >
      <View className={`w-11/12 max-w-xl px-4 py-3 rounded-md border ${palette.bg} ${palette.border}`}>
        <View className="flex-row items-center gap-3">
          {iconPack === 'fa5' ? (
            <FontAwesome5 name={iconName} color="white" size={20} />
          ) : (
            <MaterialIcons name={iconName as any} color="white" size={20} />
          )}
          <View className="flex-1 items-start">
            {title ? <Text className={`text-sm font-semibold ${palette.text}`}>{title}</Text> : null}
            <Text className={`text-base ${palette.text}`}>{text}</Text>
          </View>
          {closeable ? (
            <View className="pl-3">
              <MaterialIcons
                name="close"
                color="white"
                size={18}
                onPress={() => {
                  onCloseRef.current?.();
                }}
              />
            </View>
          ) : null}
        </View>
        <View className="mt-2 h-1 w-full rounded-full bg-white/20 overflow-hidden">
          <View
            className="h-full bg-white"
            style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
          />
        </View>
      </View>
    </View>
  );
}
