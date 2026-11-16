import type { CSSProperties } from "react";
import type { useTheme } from "storybook/theming";

export type Theme = ReturnType<typeof useTheme>;

export const inputStyle = (theme: Theme): CSSProperties => ({
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: 4,
  boxSizing: "border-box",
  color: theme.color.defaultText,
  font: "inherit",
  padding: "4px 6px",
  width: "100%",
});

export const buttonStyle = (
  background: string,
  color = "#fff",
): CSSProperties => ({
  background,
  border: 0,
  borderRadius: 4,
  color,
  cursor: "pointer",
  fontSize: 11,
  padding: "4px 8px",
});
