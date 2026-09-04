"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getNativeAppInfo, isAppStoreVnextVersion, isNativeRuntime } from "@/lib/app-native";

export function useVnextEdition() {
  const searchParams = useSearchParams();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const preview = searchParams.get("appShell") === "vnext" || searchParams.get("appShell") === "1.1";
    if (preview) {
      setEnabled(true);
      return;
    }
    if (!isNativeRuntime()) {
      setEnabled(false);
      return;
    }
    void getNativeAppInfo().then((info) => {
      setEnabled(isAppStoreVnextVersion(info?.version));
    });
  }, [searchParams]);

  return enabled;
}
