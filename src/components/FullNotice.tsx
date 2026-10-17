import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function FullNotice({ open, message, onClose }: { open: boolean; message: string; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl border border-pink-100 bg-white p-6 sm:p-8">
        <DialogHeader><DialogTitle className="font-display text-2xl text-[#5c2344]">No appointment slots right now</DialogTitle></DialogHeader>
        <p className="text-base font-medium text-[#5c2344]">{message}</p>
        <Button className="h-12 rounded-full bg-[#ff4d94] text-base" onClick={onClose}>OK</Button>
      </DialogContent>
    </Dialog>
  );
}
