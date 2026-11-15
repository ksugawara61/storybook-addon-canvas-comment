import { useId } from "react";

export type CheckboxProps = {
  defaultChecked?: boolean;
  label: string;
};

export const Checkbox = ({ defaultChecked, label }: CheckboxProps) => {
  const id = useId();
  return (
    <div className="ui-checkbox">
      <input defaultChecked={defaultChecked} id={id} type="checkbox" />
      <label htmlFor={id}>{label}</label>
    </div>
  );
};
