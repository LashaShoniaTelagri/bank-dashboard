import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";

/**
 * Confirmation modal for destructive ALE actions (crop / variety / threshold /
 * window deletes). Replaces native window.confirm so destructive actions get a
 * consistent, styled, keyboard-accessible gate. Open when `open` is true; the
 * parent owns the pending-target state and runs the delete in `onConfirm`.
 */
export const ConfirmDeleteDialog = ({
  open, title, description, confirmLabel = "Delete", busy = false, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          disabled={busy}
          onClick={(e) => { e.preventDefault(); onConfirm(); }}
          className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
        >
          {busy ? "Deleting…" : confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
