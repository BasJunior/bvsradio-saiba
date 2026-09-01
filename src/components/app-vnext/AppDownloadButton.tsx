"use client";
import { useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { downloadOffline, offlineMediaAvailable, type OfflineManifest } from "@/lib/app-offline-native";
import { getAppPreference, getNetworkStatus } from "@/lib/app-native";

export default function AppDownloadButton({trackId,surface,compact=false}:{trackId:string;surface:AppSurface;compact?:boolean}){
  const{token,signedIn}=useAppSession();const[busy,setBusy]=useState(false),[label,setLabel]=useState("Download"),[error,setError]=useState("");
  async function run(){setError("");if(!signedIn||!token)return setError("Sign in to download.");if(!offlineMediaAvailable())return setError("Available in the installed BVS app.");setBusy(true);try{const[wifiOnly,network]=await Promise.all([getAppPreference("bvs_app_wifi_downloads"),getNetworkStatus()]);if(!network.connected)throw new Error("Connect to the internet to start this download.");if(wifiOnly!=="0"&&network.connectionType!=="wifi")throw new Error("Wi-Fi only is enabled in You → Listening data.");const response=await fetch(`/api/app/offline/manifest?trackId=${encodeURIComponent(trackId)}&surface=${surface}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"}),payload=await response.json().catch(()=>({})) as {manifest?:OfflineManifest;error?:string};if(!response.ok||!payload.manifest)throw new Error(payload.error||"This recording cannot be downloaded.");await downloadOffline(payload.manifest);setLabel("Downloaded");window.dispatchEvent(new CustomEvent("bvs:offline-change"));}catch(issue){setError(issue instanceof Error?issue.message:"Download failed.")}finally{setBusy(false)}}
  return <div className={compact?"":"space-y-1"}><button type="button" disabled={busy||label==="Downloaded"} onClick={()=>void run()} className={`${compact?"min-h-9 px-3 text-xs":"min-h-11 px-4 text-sm"} rounded-full border border-white/15 font-semibold text-text-secondary disabled:opacity-60`}>{busy?"Checking rights…":label}</button>{error?<p role="status" className={`${compact?"max-w-44":"max-w-sm"} mt-1 text-xs text-amber-200`}>{error}</p>:null}</div>;
}
