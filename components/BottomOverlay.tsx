import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type BottomOverlayItem = {
  label: string;
  value: string;
};

export function BottomOverlay({
  items,
  cloudStatus = 'ok',
  syncing = false,
  onCloudLongPress,
  onManualRecPress,
}: {
  items: BottomOverlayItem[];
  cloudStatus?: 'ok' | 'error';
  syncing?: boolean;
  onManualRecPress?: () => void;
  onCloudLongPress?: () => void;
}) {
  const iconOpacity = useRef(new Animated.Value(1));
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const cloudConfig = (() => {
    if (cloudStatus === 'error') {
      return { name: 'cloud-off-outline', color: 'rgb(248 113 113)' }; // red-400
    }

    if (syncing) {
      return { name: 'cloud-upload-outline', color: 'rgb(59 130 246)' }; // blue-500
    }

    return { name: 'cloud-outline', color: 'rgb(74 222 128)' }; // green-400 when ok and not syncing
  })();

  useEffect(() => {
    if (syncing && cloudStatus === 'ok') {
      pulseRef.current?.stop();
      iconOpacity.current.setValue(1);
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(iconOpacity.current, {
            toValue: 0.35,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(iconOpacity.current, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      pulseRef.current = null;
      iconOpacity.current.setValue(1);
    }

    return () => {
      pulseRef.current?.stop();
    };
  }, [cloudStatus, syncing]);

  return (
    <View className="flex flex-row items-center justify-center gap-3 absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 rounded-md z-10">
      {items.map((item, index) => (
        <View key={item.label} className="flex flex-row items-center gap-3">
          {index > 0 && <View className="w-px h-8 bg-white/30" />}
          <View className="items-center">
            <Text className="text-xs text-white/70">{item.label}</Text>
            <Text className="text-white font-bold">{item.value}</Text>
          </View>
        </View>
      ))}
      <View className="w-px h-8 bg-white/30" />
      <Pressable
        onPress={() => onManualRecPress && onManualRecPress()}
        className="ml-2 px-3 py-1 bg-red-600 rounded-md hover:bg-red-700 active:bg-red-800"
        hitSlop={8}
      >
        <Text className="text-white text-sm font-bold">MANUAL REC</Text>
      </Pressable>
      <Pressable
        className="px-2"
        onPress={() => {}}
        onLongPress={onCloudLongPress}
        delayLongPress={350}
        hitSlop={8}
      >
        <Animated.View style={{ opacity: iconOpacity.current }}>
          <MaterialCommunityIcons name={cloudConfig.name as any} size={28} color={cloudConfig.color} />
        </Animated.View>
      </Pressable>
    </View>
  );
}
