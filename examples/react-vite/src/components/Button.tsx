import type { ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export const Button = ({
  variant = "primary",
  className,
  ...props
}: ButtonProps) => (
  <button
    type="button"
    className={["button", `button--${variant}`, className]
      .filter(Boolean)
      .join(" ")}
    {...props}
  />
);
