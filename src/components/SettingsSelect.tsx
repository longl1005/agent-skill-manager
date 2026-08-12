import { SettingsIcon } from "./SettingsIcon";

export interface SettingsSelectOption<T extends string> {
  value: T;
  label: string;
}

export function SettingsSelect<T extends string>({
  labelId,
  value,
  options,
  onChange,
}: {
  labelId: string;
  value: T;
  options: readonly SettingsSelectOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="settings-select">
      <select
        aria-labelledby={labelId}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <SettingsIcon name="chevron" size={14} />
    </div>
  );
}
