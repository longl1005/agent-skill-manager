import type { ReactNode } from "react";

export interface SettingsSegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
}

export interface SettingsSegmentedControlProps<T extends string> {
  options: readonly SettingsSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  labelId?: string;
  name?: string;
  dataTestId?: string;
}

export function SettingsSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  labelId,
  dataTestId,
}: SettingsSegmentedControlProps<T>) {
  return (
    <div
      className="settings-segmented-group"
      role="radiogroup"
      aria-labelledby={labelId}
      data-testid={dataTestId}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.ariaLabel}
            className={`settings-segmented-btn ${isSelected ? "is-active" : ""}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
