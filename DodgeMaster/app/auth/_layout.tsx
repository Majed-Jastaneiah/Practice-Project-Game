import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="signin" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="mfa-setup" />
      <Stack.Screen name="mfa-verify" />
    </Stack>
  );
}
