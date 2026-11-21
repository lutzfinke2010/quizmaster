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
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const Icon = variant === "danger" ? Trash2 : TriangleAlert;
  return <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
    {trigger && <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>}
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="rl-dialog-overlay" />
      <AlertDialog.Content className={`rl-dialog rl-dialog-${variant}`}
        onOpenAutoFocus={() => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = returnFocusRef.current?.isConnected && !returnFocusRef.current.matches(":disabled")
            ? returnFocusRef.current : document.getElementById("main-content");
          target?.focus({ preventScroll: true });
        }}>
        <div className="rl-dialog-heading">
          <span className="rl-dialog-icon" aria-hidden="true"><Icon /></span>
          <div><span className="rl-eyebrow">KURZ NACHGEFRAGT</span>
            <AlertDialog.Title className="rl-dialog-title">{title}</AlertDialog.Title></div>
        </div>
        <AlertDialog.Description className="rl-dialog-description">{description}</AlertDialog.Description>
        <div className="rl-dialog-actions">
          <AlertDialog.Cancel asChild><button type="button" className="rl-btn rl-btn-secondary">Abbrechen</button></AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <button type="button" className={`rl-btn ${variant === "danger" ? "rl-btn-danger" : "rl-btn-primary"} rl-dialog-confirm`}
              disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</button>
          </AlertDialog.Action>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
}
