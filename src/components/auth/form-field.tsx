import type { ComponentProps, ReactElement } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Label, input and the error under it, linked for screen readers. */
export function FormField(
  props: ComponentProps<typeof Input> & {
    id: string;
    label: string;
    error?: string;
  },
): ReactElement {
  const { label, error, id, ...inputProps } = props;
  const errorId = `${id}-error`;
  const hasError = error != null;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="h-11 text-base"
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        {...inputProps}
      />
      {hasError && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
