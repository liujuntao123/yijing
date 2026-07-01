import type { Bit } from "./yijing";

type Props = {
  bit: Bit;
  selected?: boolean;
  label?: string;
  onClick?: () => void;
};

export function HexLine({ bit, selected = false, label, onClick }: Props) {
  if (!onClick) return <span className={`line ${bit ? "yang" : "yin"}`} aria-hidden="true" />;

  return (
    <button
      className={`line ${bit ? "yang" : "yin"} ${selected ? "selected" : ""}`}
      type="button"
      aria-label={label}
      onClick={onClick}
    />
  );
}
