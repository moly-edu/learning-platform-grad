import { Stack } from "expo-router";

export default function TabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="class-detail" />
      <Stack.Screen name="lesson-homework" />
      <Stack.Screen name="assignment-detail" />
    </Stack>
  );
}
