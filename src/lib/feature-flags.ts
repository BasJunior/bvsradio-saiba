export const flowV2Flags = {
  qualifiedStreams:
    process.env.NEXT_PUBLIC_BVS_QUALIFIED_STREAMS === "1",

  yourBvs:
    process.env.NEXT_PUBLIC_BVS_YOUR_BVS === "1",

  pulse:
    process.env.NEXT_PUBLIC_BVS_PULSE === "1",

  nowPlayingContext:
    process.env.NEXT_PUBLIC_BVS_NOW_PLAYING_CONTEXT === "1",

  sceneTrailUi:
    process.env.NEXT_PUBLIC_BVS_SCENE_TRAIL_UI === "1",

  exploreModes:
    process.env.NEXT_PUBLIC_BVS_EXPLORE_MODES === "1",

  showRooms:
    process.env.NEXT_PUBLIC_BVS_SHOW_ROOMS === "1",

  tvExperience:
    process.env.NEXT_PUBLIC_BVS_TV_EXPERIENCE === "1",
} as const;
