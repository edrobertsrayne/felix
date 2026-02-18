import { defaultTheme, extendTheme } from "@inkjs/ui";

export const colors = {
  bg: "#1a1b26",
  fg: "#c0caf5",
  blue: "#7aa2f7",
  purple: "#bb9af7",
  cyan: "#7dcfff",
  green: "#9ece6a",
  red: "#f7768e",
  orange: "#ff9e64",
  yellow: "#e0af68",
  comment: "#565f89",
  selection: "#283457",
  terminal: {
    black: "#15161e",
    brightBlack: "#414868",
  },
} as const;

export const roleConfig = {
  user: { label: "You", color: colors.blue, prefix: "\u276f" },
  assistant: { label: "Felix", color: colors.purple, prefix: "\u25c6" },
  system: { label: "System", color: colors.red, prefix: "\u25cf" },
} as const;

export const felixTheme = extendTheme(defaultTheme, {
  components: {
    Spinner: {
      styles: {
        frame: () => ({ color: colors.purple }),
      },
    },
  },
});
