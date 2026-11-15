import type { ReactNode } from "react";

export type AlertProps = {
  children?: ReactNode;
  title: string;
  tone?: "danger" | "info" | "success";
};

export const Alert = ({ children, title, tone = "info" }: AlertProps) => (
  <div className={`ui-alert ui-alert--${tone}`} role={tone === "danger" ? "alert" : "status"}>
    <strong>{title}</strong>
    {children ? <p>{children}</p> : null}
  </div>
);
