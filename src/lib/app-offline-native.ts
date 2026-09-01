"use client";
import { registerPlugin } from "@capacitor/core";
import { isNativeRuntime } from "@/lib/app-native";

export type OfflineManifest={version:1;trackId:string;surface:"ios"|"android";title:string;artist:string;genre?:string|null;artworkUrl?:string|null;downloadUrl:string;downloadUrlExpiresAt:string;licenseIssuedAt:string;licenseValidUntil:string;requiresRevalidation:true;storagePolicy:"app-private";exportAllowed:false;clearanceReviewedAt?:string|null};
export type OfflineItem={trackId:string;surface:"ios"|"android";title:string;artist:string;artworkUrl?:string|null;licenseValidUntil:string;downloadedAt:string;bytes?:number;state?:"ready"|"expired"|"downloading"|"failed"};
type OfflinePlugin={download(options:{manifest:OfflineManifest}):Promise<{item:OfflineItem}>;list():Promise<{items:OfflineItem[]}>;remove(options:{trackId:string}):Promise<void>;status(options:{trackId:string}):Promise<{item:OfflineItem|null}>;renew(options:{manifest:OfflineManifest}):Promise<{item:OfflineItem}>};
const BvsOfflineMedia=registerPlugin<OfflinePlugin>("BvsOfflineMedia");
export function offlineMediaAvailable(){return isNativeRuntime()}
export async function downloadOffline(manifest:OfflineManifest){if(!isNativeRuntime())throw new Error("Offline downloads require the installed BVS app.");const result=await BvsOfflineMedia.download({manifest});return result.item}
export async function listOffline():Promise<OfflineItem[]>{if(!isNativeRuntime())return[];try{return(await BvsOfflineMedia.list()).items||[]}catch{return[]}}
export async function removeOffline(trackId:string){if(!isNativeRuntime())return;await BvsOfflineMedia.remove({trackId})}
export async function renewOffline(manifest:OfflineManifest){if(!isNativeRuntime())throw new Error("Offline renewal requires the installed BVS app.");return(await BvsOfflineMedia.renew({manifest})).item}
export function offlineLicenseValid(item:Pick<OfflineItem,"licenseValidUntil">){return Date.parse(item.licenseValidUntil)>Date.now()}
