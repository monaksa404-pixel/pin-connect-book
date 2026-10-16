import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function FullNotice({ open, message, onClose }: { open: boolean; message: string; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>No appointment slots right now</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button className="rounded-full" onClick={onClose}>OK</Button>
      </DialogContent>
    </Dialog>
  );
}
