import { cloneElement, useId, useState, type ReactElement } from "react";

type TooltipProps = {
  content: string;
  children: ReactElement;
};

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className="tooltip"
      onPointerEnter={() => setVisible(true)}
      onPointerLeave={() => setVisible(false)}
      onFocusCapture={() => setVisible(true)}
      onBlurCapture={() => setVisible(false)}
    >
      {cloneElement(children, { "aria-describedby": visible ? tooltipId : undefined })}
      {visible && (
        <span id={tooltipId} className="tooltip__content" role="tooltip">
          {content}
        </span>
      )}
    </span>
  );
}
