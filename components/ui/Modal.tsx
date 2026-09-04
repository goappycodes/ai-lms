"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A modal built on the native <dialog>.
 *
 * Native rather than a hand-rolled overlay because the browser then owns focus
 * trapping, Esc, the top layer (so nothing fights the sticky nav over z-index)
 * and background scroll locking — all the parts that are easy to get subtly
 * wrong and that a teacher on a phone notices first.
 *
 * `dismissible` exists for one real case: the panel showing a new password.
 * Only the hash is stored, so an Esc keypress there loses the password for
 * good. That panel takes an explicit Done and nothing else.
 */
export default function Modal({
  title,
  onClose,
  dismissible = true,
  tone,
  children,
}: {
  title: string;
  onClose: () => void;
  dismissible?: boolean;
  tone?: "warn";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Not a fixed id: two modals can share a page, and duplicate ids would point
  // every one of their labels at the first title in the document.
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof el.showModal === "function") {
      if (!el.open) el.showModal();
    } else {
      // Very old WebViews have no showModal. The dialog carries its own dim
      // background rather than relying on ::backdrop, so opening it plainly
      // still gives a usable — if not focus-trapped — overlay.
      el.setAttribute("open", "");
    }
    // React applies autoFocus on mount, which is before showModal() runs and
    // re-runs the dialog's own focusing steps — so it lands on the close
    // button instead. Place focus after opening, and only on a wide screen:
    // focusing a field on a phone throws the keyboard up over the form.
    if (window.matchMedia("(min-width: 561px)").matches) {
      el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }

    return () => {
      if (el.open) el.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={"modal" + (tone === "warn" ? " modal-warn" : "")}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Always take over: letting the browser close it would leave React
        // still thinking the modal is open.
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onMouseDown={(e) => {
        // The card fills the dialog's content box, so the dialog is only ever
        // the target when the click landed outside it.
        if (dismissible && e.target === ref.current) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-head">
          <h2 className="modal-title" id={titleId}>
            {title}
          </h2>
          {dismissible && (
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
                <path
                  d="M1 1l13 13M14 1L1 14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </dialog>
  );
}
