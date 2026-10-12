type TrackCommand = "next" | "previous";
type CommandSource = "web" | "native";

type RemoteCommandWindow = Window & {
  __bvsLastRemoteTrackCommand?: { command: TrackCommand; source: CommandSource; at: number };
};

/** WebKit and MPRemoteCommandCenter may both deliver the same system tap. */
export function runRemoteTrackCommand(command: TrackCommand, source: CommandSource, run: () => void) {
  if (typeof window === "undefined") return;
  const win = window as RemoteCommandWindow;
  const at = performance.now();
  const last = win.__bvsLastRemoteTrackCommand;
  // Suppress only a matching cross-source echo; repeated taps through the same
  // transport and on-screen player controls retain their normal behavior.
  if (last && last.command === command && last.source !== source && at - last.at < 350) return;
  win.__bvsLastRemoteTrackCommand = { command, source, at };
  run();
}
