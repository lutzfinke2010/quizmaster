import { useRef, type ReactElement } from "react";
import { AlertDialog } from "radix-ui";
import { Trash2, TriangleAlert } from "lucide-react";

export function ConfirmDialog({ title, description, confirmLabel, onConfirm, trigger, open, onOpenChange,
  variant = "danger", confirmDisabled = false }: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: "danger" | "warning";
  confirmDisabled?: boolean;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const Icon = variant === "danger" ? Trash2 : TriangleAlert;
  return <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
    {trigger && <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>}
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="confirm-overlay" />
      <AlertDialog.Content className={`confirm-dialog confirm-${variant}`}
        onOpenAutoFocus={() => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = returnFocus.current?.isConnected && !returnFocus.current.matches(":disabled")
            ? returnFocus.current : document.getElementById("main-content");
          target?.focus({ preventScroll: true });
        }}>
        <div className="confirm-heading">
          <span className="confirm-icon" aria-hidden="true"><Icon size={28} /></span>
          <div><span className="eyebrow">KURZ NACHGEFRAGT</span>
            <AlertDialog.Title>{title}</AlertDialog.Title></div>
        </div>
        <AlertDialog.Description className="confirm-description">{description}</AlertDialog.Description>
        <div className="confirm-actions">
          <AlertDialog.Cancel asChild><button type="button" className="button secondary">Abbrechen</button></AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <button type="button" className={`button ${variant === "danger" ? "danger" : "primary"} confirm-submit`}
              disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</button>
          </AlertDialog.Action>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
}
