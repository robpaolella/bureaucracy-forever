type Props = {
  count: number;
  expanded: boolean;
  controlsId: string;
  onToggle: () => void;
  label: (count: number) => string;
};

/** Accessible disclosure used by both roster views and reusable by the officer roster. */
export function AltsToggle({ count, expanded, controlsId, onToggle, label }: Props) {
  return (
    <h3 className="m-0">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={controlsId}
        onClick={onToggle}
        className="inline-flex min-h-11 items-center text-left text-small font-semibold text-teal hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        {label(count)}
      </button>
    </h3>
  );
}
