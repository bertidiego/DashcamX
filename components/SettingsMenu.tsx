import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export type SettingsItem = {
  key: string;
  label: string;
  description?: string;
  onPress?: () => void;
  status?: 'connected' | 'not-connected';
  statusLabel?: string;
};

export function SettingsMenu({
  title = 'Settings',
  items,
  onClose,
}: {
  title?: string;
  items: SettingsItem[];
  onClose: () => void;
}) {
  return (
    <View className="absolute inset-0 items-center justify-center z-20 px-3 shadow-lg" pointerEvents="box-none">
      <View className="w-full max-w-xl rounded-lg bg-black/85 border shadow-md border-white/15 h-3/4">
        <View className="flex-row items-center justify-between px-4 py-3 border-b shadow-md border-white/10">
          <Text className="text-white text-base font-semibold">{title}</Text>
          <Pressable hitSlop={12} onPress={onClose}>
            <MaterialIcons name="close" size={20} color="#fff" />
          </Pressable>
        </View>
        {items.map((item, idx) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            className={`px-4 py-3 ${idx < items.length - 1 ? 'border-b border-white/10' : ''}`}
            android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
            disabled={!item.onPress}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-white text-sm font-medium">{item.label}</Text>
                {item.description ? (
                  <Text className="text-white/70 text-xs mt-1">{item.description}</Text>
                ) : null}
              </View>
              {item.status ? (
                <View className="flex-row items-center gap-2">
                  <MaterialIcons
                    name={item.status === 'connected' ? 'check-circle' : 'cancel'}
                    size={18}
                    color={item.status === 'connected' ? '#22c55e' : '#ef4444'}
                  />
                  <Text className="text-white text-xs">
                    {item.statusLabel || (item.status === 'connected' ? 'Connected' : 'Not connected')}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
