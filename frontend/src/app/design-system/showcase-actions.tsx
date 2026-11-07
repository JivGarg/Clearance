"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export function ShowcaseActions() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={() => toast("Fix applied. You can undo it.", "success")}>Success toast</Button>
      <Button variant="secondary" onClick={() => toast("A rejection needs a reason.", "error")}>Error toast</Button>
      <Button variant="secondary" onClick={() => toast("Embargo released. Draft requeued for review.", "info")}>Info toast</Button>
      <Button variant="secondary" onClick={() => toast("Restricted information requires internal review.", "warning")}>Warning toast</Button>
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Request changes?">
        <p className="text-[15px] text-text-muted">The creator gets your reason and must upload a new revision before review restarts.</p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Request changes</Button>
        </div>
      </Modal>
    </div>
  );
}
