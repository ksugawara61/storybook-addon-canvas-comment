export type BadgeProps = {
  label: string;
  tone?: "brand" | "neutral" | "success";
};

export const Badge = ({ label, tone = "neutral" }: BadgeProps) => (
  <span className={`ui-badge ui-badge--${tone}`}>{label}</span>
);
