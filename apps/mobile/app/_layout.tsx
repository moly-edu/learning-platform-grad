import { Stack } from "expo-router";
import React from "react";
import { StatusBar } from "react-native";
import { authClient } from "@/lib/auth-client";

export default function RootLayout() {
  const { data: session } = authClient.useSession();
  return (
    <React.Fragment>
      <StatusBar hidden={true} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={session?.user.id !== undefined}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={session?.user.id === undefined}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </React.Fragment>
  );
}
