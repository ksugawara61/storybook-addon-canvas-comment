export type DividerProps = {
  label?: string;
};

export const Divider = ({ label }: DividerProps) =>
  label ? (
    <div className="ui-divider" role="separator">
      <span>{label}</span>
    </div>
  ) : (
    <hr className="ui-divider" />
  );
