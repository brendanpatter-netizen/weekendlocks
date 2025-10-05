// components/WebOnly.tsx
import { Platform } from "react-native";

export default function WebOnly({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== "web") return null;
  return <>{children}</>;
}
